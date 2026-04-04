"""Expirly Data Models
==================
Pydantic models for request/response validation.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Literal
from datetime import datetime
import uuid


# ========== Auth Models (Temporary - for Mock Auth) ==========
# TODO: Remove these when migrating to Supabase Auth.
# Supabase handles user creation/validation internally.

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime
    max_active_products: int = 3

class AuthResponse(BaseModel):
    user: UserResponse
    token: str


# ========== Niche Models ==========

class NicheCreate(BaseModel):
    niche_name: str = Field(min_length=1, max_length=50)

class NicheResponse(BaseModel):
    id: str
    user_id: str
    niche_name: str
    niche_type: Literal["default", "custom"]
    created_at: datetime
    product_count: int = 0


# ========== Product Models ==========

class ProductCreate(BaseModel):
    niche_id: str
    product_name: str = Field(min_length=1, max_length=100)
    barcode: Optional[str] = None
    product_type: Optional[str] = None
    purchase_date: Optional[datetime] = None
    production_date: Optional[datetime] = None
    expiry_date: datetime
    reminder_offset_hours: int = Field(default=24, ge=1)

class ProductResponse(BaseModel):
    id: str
    user_id: str
    niche_id: str
    niche_name: str
    product_name: str
    barcode: Optional[str] = None
    product_type: Optional[str] = None
    purchase_date: Optional[datetime] = None
    production_date: Optional[datetime] = None
    expiry_date: datetime
    reminder_at: datetime
    reminder_offset_hours: int
    status: Literal["active", "expired"]
    expiry_status: Literal["fresh", "expiring_soon", "expired"]
    created_at: datetime

class ReminderUpdate(BaseModel):
    reminder_offset_hours: Optional[int] = Field(default=None, ge=1)
    reminder_at: Optional[datetime] = None


# ========== Dashboard Models ==========

class DashboardStats(BaseModel):
    total_active: int
    expiring_soon: int
    expired: int
    max_slots: int
    slots_used: int
    slots_available: int


# ========== Alert Models ==========

class AlertItem(BaseModel):
    id: str
    product_id: str
    product_name: str
    niche_name: str
    expiry_date: datetime
    reminder_at: datetime
    alert_type: Literal["upcoming", "expiring_today", "expired"]
    message: str
