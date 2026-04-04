"""
Auth Service for Expirly
========================

SupabaseAuthService: Production auth using Supabase JWT (ES256, JWKS-validated).
MockAuthService: Kept for reference only — no longer active.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import logging
import os
import uuid

import httpx
from jose import jwt as jose_jwt, jwk as jose_jwk, JWTError

logger = logging.getLogger(__name__)


class AuthService(ABC):
    """Abstract auth service interface."""

    @abstractmethod
    async def register(self, email: str, password: str, name: str) -> dict:
        pass

    @abstractmethod
    async def login(self, email: str, password: str) -> dict:
        pass

    @abstractmethod
    async def get_current_user(self, token: str) -> dict:
        """Validate token, return dict with at least: id, email, name."""
        pass


# ── Supabase Auth Service ────────────────────────────────────────────────────

class SupabaseAuthService(AuthService):
    """
    Production auth service using Supabase Auth.

    Token validation strategy:
    1. Fetch JWKS from {supabase_url}/auth/v1/.well-known/jwks.json (cached)
    2. Verify JWT locally using the EC/RSA public key (no network round-trip per request)
    3. Falls back to Supabase /auth/v1/user REST API if JWKS validation fails

    Does NOT require service_role key — only the anon key for the API fallback.
    """

    def __init__(self, supabase_url: str, supabase_anon_key: str):
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_anon_key = supabase_anon_key
        self._jwks: dict | None = None
        self._jwks_loaded = False

    # ── Unused (auth handled client-side by Supabase) ──────────────────────

    async def register(self, email: str, password: str, name: str) -> dict:
        raise NotImplementedError("Registration is handled by Supabase Auth on the frontend")

    async def login(self, email: str, password: str) -> dict:
        raise NotImplementedError("Login is handled by Supabase Auth on the frontend")

    # ── Token Validation ───────────────────────────────────────────────────

    async def get_current_user(self, token: str) -> dict:
        """Validate Supabase JWT and return user info dict."""
        await self._ensure_jwks()
        if self._jwks and self._jwks.get("keys"):
            try:
                return self._validate_with_jwks(token)
            except ValueError as e:
                err_str = str(e)
                # If key not found → Supabase may have rotated keys → refresh JWKS once
                if "No JWKS key" in err_str:
                    logger.info("JWKS key miss — refreshing JWKS cache")
                    self._jwks_loaded = False
                    self._jwks = None
                    await self._ensure_jwks()
                    if self._jwks and self._jwks.get("keys"):
                        try:
                            return self._validate_with_jwks(token)
                        except Exception:
                            pass
                logger.warning(f"JWKS validation failed ({e}), trying API fallback")
        return await self._validate_via_api(token)

    async def _ensure_jwks(self):
        """Fetch and cache the Supabase JWKS (once per server lifetime)."""
        if self._jwks_loaded:
            return
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(
                    f"{self.supabase_url}/auth/v1/.well-known/jwks.json"
                )
                if resp.status_code == 200:
                    self._jwks = resp.json()
                    logger.info(
                        f"Supabase JWKS loaded: "
                        f"{len(self._jwks.get('keys', []))} key(s)"
                    )
        except Exception as e:
            logger.warning(f"Could not load Supabase JWKS: {e}")
        finally:
            self._jwks_loaded = True

    def _validate_with_jwks(self, token: str) -> dict:
        """Validate JWT locally using the cached JWKS public key."""
        try:
            header = jose_jwt.get_unverified_header(token)
        except Exception:
            raise ValueError("Malformed JWT header")

        kid = header.get("kid")
        alg = header.get("alg", "ES256")

        # Find matching key in JWKS
        matching_key_data = None
        for k in (self._jwks or {}).get("keys", []):
            if k.get("kid") == kid:
                matching_key_data = k
                break

        if matching_key_data is None:
            raise ValueError(f"No JWKS key for kid={kid}")

        # Decode without audience check first (Supabase aud can be string or list)
        try:
            claims = jose_jwt.decode(
                token,
                matching_key_data,
                algorithms=[alg],
                options={"verify_aud": False},
                issuer=f"{self.supabase_url}/auth/v1",
            )
        except JWTError as e:
            raise ValueError(f"JWT verification failed: {e}")

        # Manual audience check
        aud = claims.get("aud", "")
        valid_audiences = {"authenticated", "anon"}
        if isinstance(aud, list):
            if not valid_audiences.intersection(aud):
                raise ValueError(f"Invalid audience: {aud}")
        elif aud not in valid_audiences:
            raise ValueError(f"Invalid audience: {aud}")

        return self._extract_from_claims(claims)

    async def _validate_via_api(self, token: str) -> dict:
        """Fallback: validate by calling Supabase /auth/v1/user endpoint."""
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(
                f"{self.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": self.supabase_anon_key,
                },
            )

        if resp.status_code == 401:
            raise ValueError("Invalid or expired token")
        if resp.status_code != 200:
            raise ValueError(f"Supabase auth error (status {resp.status_code})")

        return self._extract_from_api(resp.json())

    @staticmethod
    def _extract_from_claims(claims: dict) -> dict:
        metadata = claims.get("user_metadata") or {}
        return {
            "id": claims["sub"],
            "email": claims.get("email", ""),
            "name": (
                metadata.get("full_name")
                or metadata.get("name")
                or claims.get("email", "User").split("@")[0]
            ),
            "user_metadata": metadata,
        }

    @staticmethod
    def _extract_from_api(data: dict) -> dict:
        metadata = data.get("user_metadata") or {}
        return {
            "id": data["id"],
            "email": data.get("email", ""),
            "name": (
                metadata.get("full_name")
                or metadata.get("name")
                or data.get("email", "User").split("@")[0]
            ),
            "user_metadata": metadata,
        }


# ── Mock Auth Service (kept for reference, no longer used) ──────────────────

class MockAuthService(AuthService):
    """
    DEPRECATED: Local mock auth using MongoDB + bcrypt.
    No longer active — Supabase auth is used in production.
    Kept here for reference only.
    """

    def __init__(self, db):
        self.db = db
        self.collection = db.mock_users

    async def register(self, email: str, password: str, name: str) -> dict:
        raise NotImplementedError("MockAuthService is no longer active")

    async def login(self, email: str, password: str) -> dict:
        raise NotImplementedError("MockAuthService is no longer active")

    async def get_current_user(self, token: str) -> dict:
        raise NotImplementedError("MockAuthService is no longer active")
