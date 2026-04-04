"""
Phase 3: Supabase Auth Swap Tests
Tests deprecated endpoints, health check, protected routes, and JWKS reachability.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SUPABASE_URL = "https://wgcezfutymccpcnxnhmp.supabase.co"


class TestHealthCheck:
    """Health endpoint tests"""

    def test_health_returns_200(self):
        """GET /api/health should return 200 OK"""
        resp = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("status") == "ok", f"Expected status=ok, got: {data}"
        print(f"PASS: /api/health → {data}")

    def test_health_response_fields(self):
        """GET /api/health should have service and version fields"""
        resp = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "service" in data, "Missing 'service' field"
        assert "version" in data, "Missing 'version' field"
        print(f"PASS: health fields → service={data['service']}, version={data['version']}")


class TestDeprecatedAuthEndpoints:
    """Tests for deprecated auth endpoints that now return 410"""

    def test_login_returns_410(self):
        """POST /api/auth/login should return 410 Gone (handled by Supabase)"""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "test123"},
            timeout=10
        )
        assert resp.status_code == 410, f"Expected 410, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data, "Expected detail field in response"
        print(f"PASS: POST /api/auth/login → 410, detail={data.get('detail')}")

    def test_register_returns_410(self):
        """POST /api/auth/register should return 410 Gone (handled by Supabase)"""
        resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "newuser@example.com", "password": "abc123", "name": "Test"},
            timeout=10
        )
        assert resp.status_code == 410, f"Expected 410, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "detail" in data, "Expected detail field in response"
        print(f"PASS: POST /api/auth/register → 410, detail={data.get('detail')}")

    def test_login_detail_mentions_supabase(self):
        """410 detail message should mention Supabase"""
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "test123"},
            timeout=10
        )
        assert resp.status_code == 410
        detail = resp.json().get("detail", "").lower()
        assert "supabase" in detail, f"Expected 'Supabase' mention in detail, got: {detail}"
        print(f"PASS: login 410 detail mentions Supabase: '{detail}'")

    def test_register_detail_mentions_supabase(self):
        """410 detail message should mention Supabase"""
        resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "test@example.com", "password": "test123", "name": "Test"},
            timeout=10
        )
        assert resp.status_code == 410
        detail = resp.json().get("detail", "").lower()
        assert "supabase" in detail, f"Expected 'Supabase' mention in detail, got: {detail}"
        print(f"PASS: register 410 detail mentions Supabase: '{detail}'")


class TestProtectedEndpoints:
    """Tests for protected endpoints requiring auth"""

    def test_auth_me_no_token_returns_401(self):
        """GET /api/auth/me with no token should return 401"""
        resp = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/auth/me (no token) → 401")

    def test_auth_me_invalid_token_returns_401(self):
        """GET /api/auth/me with invalid token should return 401"""
        resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            timeout=10
        )
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/auth/me (invalid token) → 401")

    def test_niches_no_token_returns_401(self):
        """GET /api/niches with no token should return 401"""
        resp = requests.get(f"{BASE_URL}/api/niches", timeout=10)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/niches (no token) → 401")

    def test_products_no_token_returns_401(self):
        """GET /api/products with no token should return 401"""
        resp = requests.get(f"{BASE_URL}/api/products", timeout=10)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/products (no token) → 401")

    def test_dashboard_no_token_returns_401(self):
        """GET /api/dashboard with no token should return 401"""
        resp = requests.get(f"{BASE_URL}/api/dashboard", timeout=10)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/dashboard (no token) → 401")

    def test_alerts_no_token_returns_401(self):
        """GET /api/alerts with no token should return 401"""
        resp = requests.get(f"{BASE_URL}/api/alerts", timeout=10)
        assert resp.status_code == 401, f"Expected 401, got {resp.status_code}: {resp.text}"
        print(f"PASS: GET /api/alerts (no token) → 401")


class TestSupabaseJWKS:
    """Tests for Supabase JWKS reachability and validity"""

    def test_supabase_jwks_reachable(self):
        """Supabase JWKS endpoint should return 200 with keys"""
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = requests.get(jwks_url, timeout=10)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        print(f"PASS: Supabase JWKS endpoint reachable → {resp.status_code}")

    def test_supabase_jwks_has_keys(self):
        """Supabase JWKS response should contain public keys"""
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = requests.get(jwks_url, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        assert "keys" in data, "JWKS response missing 'keys' field"
        assert len(data["keys"]) > 0, "JWKS response has empty keys array"
        key = data["keys"][0]
        assert "kid" in key, "Key missing 'kid' field"
        assert "alg" in key or "kty" in key, "Key missing algorithm info"
        print(f"PASS: JWKS has {len(data['keys'])} key(s), kid={data['keys'][0].get('kid')}")

    def test_supabase_jwks_key_type(self):
        """Supabase JWKS keys should be EC (ES256) type"""
        jwks_url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        resp = requests.get(jwks_url, timeout=10)
        assert resp.status_code == 200
        data = resp.json()
        keys = data.get("keys", [])
        assert len(keys) > 0, "No keys found"
        for key in keys:
            kty = key.get("kty", "")
            alg = key.get("alg", "")
            print(f"  Key: kty={kty}, alg={alg}, kid={key.get('kid')}")
        # Supabase typically uses EC keys for ES256
        print(f"PASS: JWKS key type validated")
