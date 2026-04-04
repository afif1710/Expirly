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

    async def send_push(self, user_id: str, title: str, body: str, url: str = "/") -> bool:
        """
        Send a push notification to all registered endpoints for a user.
        TODO: implement with pywebpush library.

        Returns True if at least one notification was sent.
        """
        raise NotImplementedError("Push delivery not yet implemented — see class docstring")

    async def register_subscription(self, user_id: str, subscription: dict) -> None:
        """
        Persist a browser PushSubscription object for server-side push delivery.
        subscription = { endpoint, keys: { p256dh, auth } }
        TODO: upsert into db.push_subscriptions.
        """
        raise NotImplementedError("Subscription registration not yet implemented")

    async def unregister_subscription(self, user_id: str, endpoint: str) -> None:
        """Remove a push subscription (e.g., on logout or permission revoke)."""
        raise NotImplementedError("Subscription removal not yet implemented")
