# MANUAL_SETUP.md - Expirly

This document covers the current auth configuration and any remaining manual steps.

---

## 1. Supabase Authentication (COMPLETE)

**Status:** Implemented and active.

### What was done:
- `SupabaseAuthService` validates Supabase JWT tokens using **JWKS ES256** (local verification, no round-trip per request)
- Falls back to Supabase `/auth/v1/user` API if JWKS fails
- On first login: user profile is auto-synced to MongoDB + 4 default niches are seeded
- Google OAuth added to Login and Register pages
- `AuthCallback` at `/auth/callback` handles PKCE code exchange

### Env vars in place:
```
# backend/.env
SUPABASE_URL=https://wgcezfutymccpcnxnhmp.supabase.co
SUPABASE_ANON_KEY=<set>

# frontend/.env
REACT_APP_SUPABASE_URL=https://wgcezfutymccpcnxnhmp.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<set>
```

### Manual steps still needed in Supabase Dashboard:

**1. URL Configuration** (if not already done):
- Go to Supabase Dashboard → Authentication → URL Configuration
- Set **Site URL**: `https://expirly-push-setup.preview.emergentagent.com`
- Add to **Redirect URLs** (one per line):
  ```
  https://expirly-push-setup.preview.emergentagent.com/**
  http://localhost:3000/**
  ```

**2. Google Provider** (if not already done):
- Go to Supabase Dashboard → Authentication → Providers → Google
- Enable Google provider
- Add your Google OAuth Client ID and Secret
- Copy the **Callback URL** shown by Supabase to your Google Cloud Console OAuth credentials
- In Google Cloud Console → OAuth credentials → Authorized redirect URIs, add:
  ```
  https://wgcezfutymccpcnxnhmp.supabase.co/auth/v1/callback
  ```

**3. Email Confirmation** (optional):
- By default Supabase requires email confirmation for email/password signups
- To disable (for testing): Dashboard → Authentication → Email → "Confirm email" → OFF

------

## 2. Database Migration (Optional)

**Current state:** Using MongoDB locally.
**Option:** Migrate to Supabase PostgreSQL for a unified backend.

### Steps:
1. Create tables in Supabase for: `niches`, `products`
2. Add Row Level Security (RLS) policies so users can only access their own data
3. Update backend endpoints to use Supabase client instead of Motor/MongoDB
4. Alternatively, keep MongoDB and only use Supabase for auth

---

## 3. Push Notifications (Future)

**Current state:** In-app alerts computed on-demand. No background notifications.
**Limitation:** Web apps cannot schedule local notifications that fire when closed.

### For Mobile (React Native / Native):
1. Use `expo-notifications` or native local notification APIs
2. When a product is created, schedule a local notification at `reminder_at`
3. When reminder is updated, cancel old notification and schedule new one

### For Push Notifications:
1. Set up Firebase Cloud Messaging (FCM) or APNs
2. Store device tokens in the database
3. Create a backend job/cron that checks for upcoming reminders
4. Send push notifications at the right time

---

## 4. Payments (Future)

**Current state:** Free tier hardcoded to 3 active products.
**What to do:**

1. Choose a payment provider (Stripe recommended)
2. Create subscription plans (Free, Premium)
3. Add `subscription_tier` and `subscription_expires_at` fields to user model
4. Update `max_active_products` based on subscription tier
5. Add a payment/upgrade flow in the Profile page

---

## 5. Environment Variables Summary

### Backend (.env) - TODO items:
```
# Already configured:
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
CORS_ORIGINS="*"

# TODO: Add these for production:
JWT_SECRET=generate-a-secure-secret-here
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### Frontend (.env) - TODO items:
```
# Already configured:
REACT_APP_BACKEND_URL=your-backend-url

# TODO: Add these for Supabase:
REACT_APP_SUPABASE_URL=your-supabase-project-url
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

## 6. Files to Modify During Migration

| File | What to change |
|------|---------------|
| `backend/auth_service.py` | Add SupabaseAuthService, keep interface |
| `backend/server.py` | Swap auth_service instantiation |
| `frontend/src/contexts/AuthContext.tsx` | Use Supabase auth methods |
| `frontend/src/lib/api.ts` | Use Supabase session token |
| `frontend/src/pages/Login.tsx` | Add Google OAuth button (optional) |
| `frontend/src/pages/Register.tsx` | Add Google OAuth button (optional) |
| `frontend/src/pages/Profile.tsx` | Add upgrade/payment section |

---

## 7. Phase 2 — Barcode Scanning (Camera Permissions)

**Current state:** Barcode scanning is built and functional in Chrome/Firefox on Android/iOS.

### Real Device Setup
The barcode scanner uses the browser's camera API. On real devices:
1. The app must be served over **HTTPS** (required for camera access in all browsers)
2. On first use, the browser will prompt for camera permission — user must allow
3. Use the rear camera (`facingMode: "environment"`) for best barcode scanning results
4. Supported formats: EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, QR Code

### Fallback behaviour
- If camera permission is denied → graceful error screen with "Enter Manually" button
- If no camera on device → graceful error screen
- If barcode not in Open Food Facts database → form stays editable, no crash
- Manual barcode entry always works regardless of camera availability

### Open Food Facts
- No API key required — it's a free, open database
- The backend proxies requests to `https://world.openfoodfacts.org`
- Covers most consumer food products worldwide (EAN, UPC barcodes)
- Non-food items (cosmetics, medicine) may not be in the database — manual fallback applies

---

## Quick Start (Current Mock Mode)

The app works locally right now with mock auth:
1. `cd backend && pip install -r requirements.txt`
2. `cd frontend && yarn install`
3. Start MongoDB, backend (uvicorn), and frontend (vite)
4. Register any email/password to get started
5. Default niches (Fridge, Pantry, Medicine, Cosmetics) are created on registration
