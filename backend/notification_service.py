"""
Notification Service Abstraction for Expirly
=============================================

Architecture:
  InAppNotificationService  ← ACTIVE: computes alerts on-demand from product data
  WebPushNotificationService ← STUB: ready to wire up FCM/VAPID/APNs later
  NotificationPreferences    ← dataclass for per-user notification settings

To enable real push notifications later:
  1. Generate VAPID key pair (web-push library)
  2. Store push subscriptions in MongoDB  (user_id → PushSubscription)
  3. Implement WebPushNotificationService.send_push() with web-push library
  4. Register a service-worker on the frontend (public/sw.js)
  5. Call register_subscription() from the frontend after permission is granted
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
import asyncio
import json
import logging
import uuid

from pymongo import ReturnDocument
from pywebpush import WebPushException, webpush

logger = logging.getLogger(__name__)

PUSH_SWEEP_BATCH_SIZE = 100
PUSH_CLAIM_TIMEOUT_SECONDS = 300


# ── Preferences dataclass ──────────────────────────────────────────────────

@dataclass
class NotificationPreferences:
    """Per-user notification preferences (stored in localStorage on frontend for now)."""
    push_enabled: bool = False       # Whether user has granted push permission
    quiet_hours_start: int = 22      # 10 PM local time — do not send push after this
    quiet_hours_end: int = 8         # 8 AM local time — do not send push before this
    default_reminder_hours: int = 24  # Default reminder offset (hours before expiry)

    @classmethod
    def default(cls) -> "NotificationPreferences":
        return cls()


# ── Abstract interface ─────────────────────────────────────────────────────

class NotificationService(ABC):
    """Abstract notification service. Implement per platform/delivery channel."""

    @abstractmethod
    async def get_pending_alerts(self, user_id: str) -> List[dict]:
        """Get all pending/active alerts for a user."""
        pass

    @abstractmethod
    async def compute_alerts_for_products(self, products: List[dict]) -> List[dict]:
        """Compute alert state for a list of products."""
        pass


# ── In-App (ACTIVE) ────────────────────────────────────────────────────────

class InAppNotificationService(NotificationService):
    """
    In-app notification service — ACTIVE.
    Computes alerts on-demand when the user opens the app.
    No background/push delivery in current web runtime.
    """

    def __init__(self, db):
        self.db = db

    async def get_pending_alerts(self, user_id: str) -> List[dict]:
        products = await self.db.products.find(
            {"user_id": user_id}
        ).to_list(100)

        niche_ids = list(set(p.get("niche_id") for p in products if p.get("niche_id")))
        niches = {}
        if niche_ids:
            niche_docs = await self.db.niches.find(
                {"id": {"$in": niche_ids}}
            ).to_list(100)
            niches = {n["id"]: n["niche_name"] for n in niche_docs}

        for p in products:
            p["niche_name"] = niches.get(p.get("niche_id"), "Unknown")

        return await self.compute_alerts_for_products(products)

    async def compute_alerts_for_products(self, products: List[dict]) -> List[dict]:
        now = datetime.now(timezone.utc)
        alerts = []

        for product in products:
            expiry_date = product.get("expiry_date")
            reminder_at = product.get("reminder_at")

            if not expiry_date:
                continue

            if expiry_date.tzinfo is None:
                expiry_date = expiry_date.replace(tzinfo=timezone.utc)
            if reminder_at and reminder_at.tzinfo is None:
                reminder_at = reminder_at.replace(tzinfo=timezone.utc)

            alert_type: Optional[str] = None
            message = ""

            if expiry_date <= now:
                alert_type = "expired"
                message = f"{product['product_name']} has expired"
            elif reminder_at and reminder_at <= now:
                if expiry_date.date() == now.date():
                    alert_type = "expiring_today"
                    message = f"{product['product_name']} expires today!"
                else:
                    days_left = (expiry_date - now).days
                    alert_type = "upcoming"
                    if days_left == 0:
                        hours_left = int((expiry_date - now).total_seconds() // 3600)
                        message = f"{product['product_name']} expires in {hours_left} hour{'s' if hours_left != 1 else ''}"
                    else:
                        message = f"{product['product_name']} expires in {days_left} day{'s' if days_left != 1 else ''}"
            else:
                continue

            alerts.append({
                "id": product["id"],
                "product_id": product["id"],
                "product_name": product["product_name"],
                "niche_name": product.get("niche_name", ""),
                "expiry_date": expiry_date,
                "reminder_at": reminder_at,
                "alert_type": alert_type,
                "message": message,
            })

        priority = {"expiring_today": 0, "upcoming": 1, "expired": 2}
        alerts.sort(key=lambda a: (priority.get(a["alert_type"], 3), a["expiry_date"]))
        return alerts


# ── Web Push (STUB — not yet active) ──────────────────────────────────────

class WebPushNotificationService(NotificationService):
    """
    Web Push notification delivery — STUB.

    Not yet active. Connect this when implementing real push notifications.

    Integration steps:
    1. pip install pywebpush
    2. Generate VAPID keys: webpush_generate_keys()
    3. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to backend/.env
    4. Store push subscriptions in db.push_subscriptions {user_id, subscription, created_at}
    5. Implement send_push() with pywebpush.webpush()
    6. Register service worker + subscribe on frontend (public/sw.js)
    7. Add POST /api/notifications/subscribe endpoint to save subscription
    8. Schedule background job (APScheduler or Celery) to call send_push() at reminder_at times
    """

    def __init__(self, db, vapid_private_key: str = "", vapid_claims: dict = None):
        self.db = db
        self.vapid_private_key = vapid_private_key
        self.vapid_claims = vapid_claims or {"sub": "mailto:noreply@expirly.app"}

    async def get_pending_alerts(self, user_id: str) -> List[dict]:
        # Delegate alert computation to InAppNotificationService logic
        # Actual push delivery goes through send_push()
        raise NotImplementedError("WebPush: use send_push() for delivery")

    async def compute_alerts_for_products(self, products: List[dict]) -> List[dict]:
        raise NotImplementedError("WebPush: use send_push() for delivery")

    @staticmethod
    def _build_payload(title: str, body: str, url: str) -> str:
        return json.dumps({"title": title, "body": body, "url": url})

    @staticmethod
    def _build_product_message(product: dict) -> tuple[str, str]:
        now = datetime.now(timezone.utc)
        expiry_date = product["expiry_date"]
        if expiry_date.tzinfo is None:
            expiry_date = expiry_date.replace(tzinfo=timezone.utc)

        if expiry_date.date() == now.date():
            return "Expirly reminder", f"{product['product_name']} expires today."

        days_left = max(1, (expiry_date.date() - now.date()).days)
        return "Expirly reminder", (
            f"{product['product_name']} expires in {days_left} day"
            f"{'s' if days_left != 1 else ''}."
        )

    async def send_push(self, user_id: str, title: str, body: str, url: str = "/") -> dict:
        """
        Send a push notification to all registered endpoints for a user.

        Returns delivery stats for the user's active subscriptions.
        """
        if not self.vapid_private_key:
            raise ValueError("VAPID_PRIVATE_KEY is not configured")

        subscriptions = await self.db.push_subscriptions.find(
            {"user_id": user_id},
            {"_id": 0},
        ).to_list(100)

        if not subscriptions:
            return {
                "sent": False,
                "attempted_subscriptions": 0,
                "successful_subscriptions": 0,
                "removed_subscriptions": 0,
            }

        payload = self._build_payload(title, body, url)
        successful_subscriptions = 0
        removed_subscriptions = 0

        for subscription_doc in subscriptions:
            endpoint = subscription_doc.get("endpoint")
            try:
                await asyncio.to_thread(
                    webpush,
                    subscription_info=subscription_doc["subscription"],
                    data=payload,
                    vapid_private_key=self.vapid_private_key,
                    vapid_claims=self.vapid_claims,
                    ttl=300,
                )
                successful_subscriptions += 1
            except WebPushException as exc:
                response = getattr(exc, "response", None)
                status_code = getattr(response, "status_code", None) or getattr(exc, "status_code", None)
                logger.warning(f"Web push failed for {endpoint}: {status_code or 'unknown'}")
                if status_code in {404, 410} and endpoint:
                    await self.unregister_subscription(user_id, endpoint)
                    removed_subscriptions += 1
            except Exception as exc:
                logger.warning(f"Unexpected push delivery error for {endpoint}: {exc}")

        return {
            "sent": successful_subscriptions > 0,
            "attempted_subscriptions": len(subscriptions),
            "successful_subscriptions": successful_subscriptions,
            "removed_subscriptions": removed_subscriptions,
        }

    async def register_subscription(self, user_id: str, subscription: dict) -> None:
        """
        Persist a browser PushSubscription object for server-side push delivery.
        subscription = { endpoint, keys: { p256dh, auth } }
        """
        now = datetime.now(timezone.utc)
        endpoint = subscription["endpoint"]
        await self.db.push_subscriptions.update_one(
            {"user_id": user_id, "endpoint": endpoint},
            {
                "$set": {
                    "endpoint": endpoint,
                    "subscription": subscription,
                    "expiration_time": subscription.get("expirationTime"),
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "created_at": now,
                },
            },
            upsert=True,
        )

    async def unregister_subscription(self, user_id: str, endpoint: str) -> None:
        """Remove a push subscription (e.g., on logout or permission revoke)."""
        await self.db.push_subscriptions.delete_one({"user_id": user_id, "endpoint": endpoint})

    async def sweep_due_reminders(self, limit: int = PUSH_SWEEP_BATCH_SIZE) -> dict:
        """Claim and send all currently due, unsent reminder pushes up to the limit."""
        if not self.vapid_private_key:
            raise ValueError("VAPID_PRIVATE_KEY is not configured")

        now = datetime.now(timezone.utc)
        stale_claim_threshold = datetime.fromtimestamp(
            now.timestamp() - PUSH_CLAIM_TIMEOUT_SECONDS,
            tz=timezone.utc,
        )

        processed_products = 0
        notified_products = 0
        attempted_subscriptions = 0
        successful_subscriptions = 0
        removed_subscriptions = 0

        while processed_products < limit:
            product = await self.db.products.find_one_and_update(
                {
                    "reminder_at": {"$lte": now},
                    "expiry_date": {"$gt": now},
                    "$and": [
                        {
                            "$or": [
                                {"reminder_push_sent_at": {"$exists": False}},
                                {"reminder_push_sent_at": None},
                            ]
                        },
                        {
                            "$or": [
                                {"reminder_push_claimed_at": {"$exists": False}},
                                {"reminder_push_claimed_at": None},
                                {"reminder_push_claimed_at": {"$lte": stale_claim_threshold}},
                            ]
                        },
                    ],
                },
                {"$set": {"reminder_push_claimed_at": now}},
                sort=[("reminder_at", 1)],
                projection={"_id": 0},
                return_document=ReturnDocument.AFTER,
            )

            if not product:
                break

            processed_products += 1
            title, body = self._build_product_message(product)
            delivery = await self.send_push(product["user_id"], title, body, url="/alerts")

            attempted_subscriptions += delivery["attempted_subscriptions"]
            successful_subscriptions += delivery["successful_subscriptions"]
            removed_subscriptions += delivery["removed_subscriptions"]

            if delivery["sent"]:
                notified_products += 1
                await self.db.products.update_one(
                    {"id": product["id"]},
                    {
                        "$set": {"reminder_push_sent_at": now},
                        "$unset": {"reminder_push_claimed_at": ""},
                    },
                )
            else:
                await self.db.products.update_one(
                    {"id": product["id"]},
                    {"$unset": {"reminder_push_claimed_at": ""}},
                )

        return {
            "processed_products": processed_products,
            "notified_products": notified_products,
            "attempted_subscriptions": attempted_subscriptions,
            "successful_subscriptions": successful_subscriptions,
            "removed_subscriptions": removed_subscriptions,
        }
