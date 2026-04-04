"""
Expirly Backend API
===================
FastAPI application with MongoDB storage.

Auth Strategy:
  Uses Supabase Auth with JWT validation (ES256/JWKS).
  Tokens are issued by Supabase (Google OAuth or email/password).
  Backend validates tokens using Supabase JWKS endpoint.
  See MANUAL_SETUP.md for Supabase configuration.
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import requests as http_requests
from pathlib import Path
from typing import Optional, List
import uuid
from datetime import datetime, timedelta, timezone

from models import (
    UserResponse, NicheCreate, NicheResponse,
    ProductCreate, ProductResponse, ReminderUpdate,
    DashboardStats, AlertItem, PushSubscriptionPayload,
    PushSubscriptionDeleteRequest, VapidPublicKeyResponse,
    PushSubscriptionResponse, PushDeliverySweepResponse,
)
from auth_service import SupabaseAuthService
from notification_service import InAppNotificationService, WebPushNotificationService

# ========== Configuration ==========

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'expirly')]

app = FastAPI(title="Expirly API", version="1.0.0")
api_router = APIRouter(prefix="/api")

# ========== Services ==========
auth_service = SupabaseAuthService(
    supabase_url=os.environ["SUPABASE_URL"],
    supabase_anon_key=os.environ["SUPABASE_ANON_KEY"],
)
notification_service = InAppNotificationService(db)
web_push_service = WebPushNotificationService(
    db,
    vapid_private_key=os.environ.get("VAPID_PRIVATE_KEY", ""),
    vapid_claims={"sub": f"mailto:{os.environ.get('VAPID_CLAIMS_EMAIL', 'noreply@expirly.app')}"},
)

# ========== Constants ==========
DEFAULT_NICHES = ["Fridge", "Pantry", "Medicine", "Cosmetics"]
FREE_TIER_MAX_PRODUCTS = 3

# ========== Logging ==========
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ========== Startup / Shutdown ==========

@app.on_event("startup")
async def startup_db():
    """Create indexes on startup."""
    try:
        # Users (Supabase user profiles synced on first login)
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email")        # Niches
        await db.niches.create_index([("user_id", 1), ("niche_name", 1)], unique=True)
        await db.niches.create_index("id", unique=True)
        # Products
        await db.products.create_index("id", unique=True)
        await db.products.create_index("user_id")
        await db.products.create_index([("user_id", 1), ("niche_id", 1)])
        await db.products.create_index([("reminder_push_sent_at", 1), ("reminder_at", 1), ("expiry_date", 1)])
        await db.push_subscriptions.create_index([("user_id", 1), ("endpoint", 1)], unique=True)
        await db.push_subscriptions.create_index("user_id")
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ========== Auth Dependency ==========

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Validate Supabase JWT from Authorization header.
    On first login, syncs the Supabase user profile to MongoDB and seeds default niches.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ", 1)[1]

    try:
        supabase_user = await auth_service.get_current_user(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user_id = supabase_user["id"]

    # Look up MongoDB user profile (keyed by Supabase user ID)
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})

    if not user_doc:
        # First login — create profile and seed default niches
        user_doc = {
            "id": user_id,
            "email": supabase_user["email"],
            "name": supabase_user["name"],
            "created_at": datetime.now(timezone.utc),
            "max_active_products": FREE_TIER_MAX_PRODUCTS,
        }
        try:
            await db.users.insert_one({**user_doc})
        except Exception:
            pass  # Race condition: another request beat us, that's fine

        # Seed default niches (idempotent: unique index prevents duplicates)
        for niche_name in DEFAULT_NICHES:
            niche_doc = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "niche_name": niche_name,
                "niche_type": "default",
                "created_at": datetime.now(timezone.utc),
            }
            try:
                await db.niches.insert_one(niche_doc)
            except Exception:
                pass  # Already exists — fine

        logger.info(f"New user profile created for: {supabase_user['email']}")

    return user_doc


# ========== Helper Functions ==========

def compute_expiry_status(expiry_date: datetime, reminder_at: datetime) -> str:
    """Compute display status: fresh, expiring_soon, or expired."""
    now = datetime.now(timezone.utc)
    # Make timezone-aware if naive
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    if reminder_at and reminder_at.tzinfo is None:
        reminder_at = reminder_at.replace(tzinfo=timezone.utc)

    if expiry_date <= now:
        return "expired"
    if reminder_at and reminder_at <= now:
        return "expiring_soon"
    return "fresh"


def compute_product_status(expiry_date: datetime) -> str:
    """Compute storage status: active or expired."""
    now = datetime.now(timezone.utc)
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)
    return "expired" if expiry_date <= now else "active"


async def enrich_product(product: dict) -> dict:
    """Add computed fields and niche name to product."""
    product.pop("_id", None)
    expiry_date = product["expiry_date"]
    reminder_at = product.get("reminder_at", expiry_date)
    product["status"] = compute_product_status(expiry_date)
    product["expiry_status"] = compute_expiry_status(expiry_date, reminder_at)
    # Lookup niche name
    niche = await db.niches.find_one({"id": product.get("niche_id")})
    product["niche_name"] = niche["niche_name"] if niche else "Unknown"
    return product


# ========== Auth Routes ==========

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    """Get the current authenticated user's profile."""
    return UserResponse(**user)


@api_router.post("/auth/register")
async def register_deprecated():
    """Removed: registration is now handled by Supabase Auth on the frontend."""
    raise HTTPException(
        status_code=410,
        detail="Email/password registration is handled by Supabase Auth on the frontend."
    )


@api_router.post("/auth/login")
async def login_deprecated():
    """Removed: login is now handled by Supabase Auth on the frontend."""
    raise HTTPException(
        status_code=410,
        detail="Email/password login is handled by Supabase Auth on the frontend."
    )


# ========== Niche Routes ==========

@api_router.get("/niches", response_model=List[NicheResponse])
async def list_niches(user=Depends(get_current_user)):
    """List all niches for the current user."""
    niches = await db.niches.find({"user_id": user["id"]}).sort("created_at", 1).to_list(100)
    result = []
    for niche in niches:
        product_count = await db.products.count_documents({
            "user_id": user["id"],
            "niche_id": niche["id"],
        })
        niche_data = {k: v for k, v in niche.items() if k != "_id"}
        niche_data["product_count"] = product_count
        result.append(NicheResponse(**niche_data))
    return result


@api_router.post("/niches", response_model=NicheResponse, status_code=201)
async def create_niche(data: NicheCreate, user=Depends(get_current_user)):
    """Create a custom niche."""
    # Check if niche name already exists for user (case insensitive)
    existing = await db.niches.find_one({
        "user_id": user["id"],
        "niche_name": {"$regex": f"^{data.niche_name.strip()}$", "$options": "i"},
    })
    if existing:
        raise HTTPException(status_code=400, detail="A niche with this name already exists")

    niche_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "niche_name": data.niche_name.strip(),
        "niche_type": "custom",
        "created_at": datetime.now(timezone.utc),
    }
    await db.niches.insert_one(niche_doc)
    niche_doc.pop("_id", None)
    niche_doc["product_count"] = 0
    return NicheResponse(**niche_doc)


@api_router.delete("/niches/{niche_id}")
async def delete_niche(niche_id: str, user=Depends(get_current_user)):
    """Delete a custom niche (only if empty and not a default niche)."""
    niche = await db.niches.find_one({"id": niche_id, "user_id": user["id"]})
    if not niche:
        raise HTTPException(status_code=404, detail="Niche not found")

    if niche["niche_type"] == "default":
        raise HTTPException(status_code=400, detail="Cannot delete default niches")

    product_count = await db.products.count_documents({
        "niche_id": niche_id,
        "user_id": user["id"],
    })
    if product_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete niche that has products")

    await db.niches.delete_one({"id": niche_id})
    return {"message": "Niche deleted"}


# ========== Product Routes ==========

@api_router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(data: ProductCreate, user=Depends(get_current_user)):
    """Create a product under a niche. Enforces free tier slot limit."""
    # Validate niche exists and belongs to user
    niche = await db.niches.find_one({"id": data.niche_id, "user_id": user["id"]})
    if not niche:
        raise HTTPException(
            status_code=400,
            detail="Invalid niche. Please select or create a niche first."
        )

    # Expiry date must be in the future
    now = datetime.now(timezone.utc)
    expiry = data.expiry_date
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if expiry <= now:
        raise HTTPException(status_code=400, detail="Expiry date must be in the future")

    # Check free tier slot limit (count only active/non-expired products)
    active_count = await db.products.count_documents({
        "user_id": user["id"],
        "expiry_date": {"$gt": datetime.now(timezone.utc)},
    })
    max_products = user.get("max_active_products", FREE_TIER_MAX_PRODUCTS)
    if active_count >= max_products:
        raise HTTPException(
            status_code=403,
            detail=f"Free tier limit reached ({max_products} active products). "
                   f"Delete expired products to free up slots."
        )

    # Calculate reminder_at from offset
    reminder_at = expiry - timedelta(hours=data.reminder_offset_hours)
    if reminder_at >= expiry:
        raise HTTPException(status_code=400, detail="Reminder must be before expiry date")

    product_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "niche_id": data.niche_id,
        "product_name": data.product_name.strip(),
        "barcode": data.barcode,
        "product_type": data.product_type,
        "purchase_date": data.purchase_date,
        "production_date": data.production_date,
        "expiry_date": expiry,
        "reminder_at": reminder_at,
        "reminder_offset_hours": data.reminder_offset_hours,
        "created_at": datetime.now(timezone.utc),
    }

    await db.products.insert_one(product_doc)
    enriched = await enrich_product(product_doc)
    logger.info(f"Product created: {data.product_name} by user {user['id']}")
    return ProductResponse(**enriched)


@api_router.get("/products", response_model=List[ProductResponse])
async def list_products(
    niche_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
):
    """List products. Optional filters: niche_id, status (fresh/expiring_soon/expired)."""
    query = {"user_id": user["id"]}
    if niche_id:
        query["niche_id"] = niche_id

    products = await db.products.find(query).sort("expiry_date", 1).to_list(100)
    result = []
    for product in products:
        enriched = await enrich_product(product)
        if status and enriched["expiry_status"] != status:
            continue
        result.append(ProductResponse(**enriched))
    return result


@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, user=Depends(get_current_user)):
    """Get a single product by ID."""
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    enriched = await enrich_product(product)
    return ProductResponse(**enriched)


@api_router.patch("/products/{product_id}/reminder", response_model=ProductResponse)
async def update_reminder(product_id: str, data: ReminderUpdate, user=Depends(get_current_user)):
    """
    Update ONLY the reminder timing of a product.
    Product details cannot be edited after creation.
    Reminder cannot be set at or after the expiry date.
    """
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    expiry_date = product["expiry_date"]
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)

    # Compute new reminder_at
    if data.reminder_at is not None:
        new_reminder_at = data.reminder_at
        if new_reminder_at.tzinfo is None:
            new_reminder_at = new_reminder_at.replace(tzinfo=timezone.utc)
        # Calculate offset from the new reminder_at
        offset_seconds = (expiry_date - new_reminder_at).total_seconds()
        new_offset_hours = max(1, int(offset_seconds / 3600))
    elif data.reminder_offset_hours is not None:
        new_reminder_at = expiry_date - timedelta(hours=data.reminder_offset_hours)
        new_offset_hours = data.reminder_offset_hours
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either reminder_at or reminder_offset_hours"
        )

    # Validate: reminder cannot be at or after expiry
    if new_reminder_at >= expiry_date:
        raise HTTPException(
            status_code=400,
            detail="Reminder time cannot be at or after the expiry date"
        )

    update_data = {
        "reminder_at": new_reminder_at,
        "reminder_offset_hours": new_offset_hours,
    }

    await db.products.update_one(
        {"id": product_id},
        {
            "$set": update_data,
            "$unset": {
                "reminder_push_sent_at": "",
                "reminder_push_claimed_at": "",
            },
        },
    )

    product.update(update_data)
    enriched = await enrich_product(product)
    return ProductResponse(**enriched)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(get_current_user)):
    """
    Delete a product. ONLY expired products can be deleted.
    Deleting frees up one active product slot.
    """
    product = await db.products.find_one({"id": product_id, "user_id": user["id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    expiry_date = product["expiry_date"]
    if expiry_date.tzinfo is None:
        expiry_date = expiry_date.replace(tzinfo=timezone.utc)

    if expiry_date > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=403,
            detail="Cannot delete a product before it expires. Products can only be removed after expiry."
        )

    await db.products.delete_one({"id": product_id})
    return {"message": "Product deleted. Slot freed."}


# ========== Dashboard Route ==========

@api_router.get("/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    """Get dashboard data: stats + products grouped by status."""
    products = await db.products.find(
        {"user_id": user["id"]}
    ).sort("expiry_date", 1).to_list(100)

    enriched_products = []
    for p in products:
        enriched = await enrich_product(p)
        enriched_products.append(enriched)

    active = [p for p in enriched_products if p["expiry_status"] != "expired"]
    expiring_soon = [p for p in enriched_products if p["expiry_status"] == "expiring_soon"]
    expired = [p for p in enriched_products if p["expiry_status"] == "expired"]
    fresh = [p for p in enriched_products if p["expiry_status"] == "fresh"]

    max_products = user.get("max_active_products", FREE_TIER_MAX_PRODUCTS)

    stats = {
        "total_active": len(active),
        "expiring_soon": len(expiring_soon),
        "expired": len(expired),
        "max_slots": max_products,
        "slots_used": len(active),
        "slots_available": max(0, max_products - len(active)),
    }

    return {
        "stats": stats,
        "products": enriched_products,
        "expiring_soon": expiring_soon,
        "fresh": fresh,
        "expired": expired,
    }


# ========== Alert Routes ==========

@api_router.get("/alerts")
async def get_alerts(user=Depends(get_current_user)):
    """Get alerts/reminders for the current user."""
    alerts = await notification_service.get_pending_alerts(user["id"])
    return {"alerts": alerts, "count": len(alerts)}


@api_router.get("/notifications/vapid-public-key", response_model=VapidPublicKeyResponse)
async def get_vapid_public_key():
    """Return the configured VAPID public key for browser push subscription setup."""
    public_key = os.environ.get("VAPID_PUBLIC_KEY")
    if not public_key:
        raise HTTPException(status_code=503, detail="Push notifications are not configured")
    return VapidPublicKeyResponse(public_key=public_key)


@api_router.post("/notifications/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_notifications(
    subscription: PushSubscriptionPayload,
    user=Depends(get_current_user),
):
    """Register or update a browser push subscription for the current user."""
    await web_push_service.register_subscription(user["id"], subscription.dict())
    return PushSubscriptionResponse(
        message="Push subscription registered",
        endpoint=subscription.endpoint,
    )


@api_router.delete("/notifications/unsubscribe", response_model=PushSubscriptionResponse)
async def unsubscribe_from_notifications(
    data: PushSubscriptionDeleteRequest,
    user=Depends(get_current_user),
):
    """Remove a browser push subscription for the current user."""
    await web_push_service.unregister_subscription(user["id"], data.endpoint)
    return PushSubscriptionResponse(
        message="Push subscription removed",
        endpoint=data.endpoint,
    )


@api_router.post("/notifications/sweep", response_model=PushDeliverySweepResponse)
async def sweep_due_notifications(user=Depends(get_current_user)):
    """Sweep and send all currently due reminder pushes using stored subscriptions."""
    try:
        return PushDeliverySweepResponse(**(await web_push_service.sweep_due_reminders()))
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ========== Food Lookup (Open Food Facts proxy) ==========

@api_router.get("/food/lookup")
def food_lookup(barcode: str, user=Depends(get_current_user)):
    """
    Proxy lookup for a food product by barcode via Open Food Facts.
    Uses a sync def so FastAPI runs it in a thread pool (safe with requests library).
    Returns 404 if barcode is not in the food database — caller should fall back to manual entry.
    """
    import time
    barcode = barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required")

    url = (
        f"https://world.openfoodfacts.org/api/v2/product/{barcode}"
        f"?fields=product_name,product_name_en,brands,categories"
    )
    headers = {
        "User-Agent": "Expirly/1.0 (expiry-reminder-app; https://github.com/expirly)",
        "Accept": "application/json",
    }

    # Retry up to 2 times for transient failures
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            resp = http_requests.get(url, headers=headers, timeout=8)
            data = resp.json()

            if data.get("status") != 1 or not data.get("product"):
                raise HTTPException(status_code=404, detail="Product not found in food database")

            p = data["product"]
            product_name = (p.get("product_name_en") or p.get("product_name") or "").strip()
            brand = (p.get("brands") or "").strip()
            categories = (p.get("categories") or "").strip()
            first_category = categories.split(",")[0].strip() if categories else ""

            if not product_name:
                raise HTTPException(status_code=404, detail="Product found but name unavailable")

            logger.info(f"Food lookup: barcode={barcode} → {product_name}")
            return {
                "found": True,
                "barcode": barcode,
                "product_name": product_name,
                "brand": brand,
                "category": first_category,
            }
        except HTTPException:
            raise
        except Exception as e:
            last_exc = e
            if attempt == 0:
                time.sleep(0.5)  # Brief wait before retry

    logger.warning(f"Food lookup failed for barcode={barcode}: {last_exc}")
    raise HTTPException(status_code=503, detail="Food database temporarily unavailable")


# ========== Health Check ==========

@api_router.get("/health")
async def health_check():
    return {"status": "ok", "service": "expirly", "version": "1.0.0"}


# ========== Include Router & Middleware ==========

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
