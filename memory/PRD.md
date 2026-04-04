# Expirly - Product Requirements Document (Phase 1 MVP)

## Purpose
Simple mobile-first expiry reminder app. Users organize products into niches/categories and get reminded before expiry.

## Core Flow
1. Sign in → 2. Create/select niche → 3. Add product (scan barcode or manual) → 4. Set expiry + reminder → 5. Track from dashboard + alerts → 6. Delete only after expired

## Business Rules
- Free tier: 3 active products max
- Product details locked after save (only reminder editable)
- Reminder cannot exceed expiry date
- Products can only be deleted after expiry
- Default niches: Fridge, Pantry, Medicine, Cosmetics
- Custom niches allowed

## Tech Stack
- Backend: FastAPI + MongoDB
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Auth: Mock (abstracted for Supabase swap)
- Notifications: In-app (abstracted for push notification support later)

## Design
- Sage/soft green palette
- Mobile-first, rounded cards, bottom tab navigation
- Clean, minimal, serene interface

---

## Phase 1: MVP (Complete)
- Full auth flow (mock/demo), niche management, product CRUD
- Dashboard (slot indicator, product groups), Alerts, Profile
- All 13 backend business rule tests passed

## Phase 2: Barcode Scanning + Stabilization (Complete)
- html5-qrcode camera barcode scanner (BarcodeScanner component)
- Open Food Facts product lookup proxied via backend (GET /api/food/lookup)
- Product name autofill on barcode scan/lookup
- Graceful fallback for camera unavailable, barcode not found, service error
- Added retry logic in backend for intermittent Open Food Facts responses
- Added data-testid attributes throughout for testability
- 22/22 backend tests passed

---

## Phase 3: Supabase Auth + Google OAuth (Complete — Apr 2026)
- SupabaseAuthService with JWKS ES256 local validation + API fallback (no service_role key)
- JWKS cache with auto-refresh on key rotation miss
- Google OAuth: signInWithOAuth → /auth/callback PKCE exchange → MongoDB profile auto-sync
- Login + Register: "Continue with Google" (primary) + email/password (secondary, via Supabase)
- AuthCallback.tsx handles code exchange; deprecated mock endpoints return 410
- 15/15 backend + 12/12 frontend tests passed (100%)

## Upcoming (P1-P2)
- P1: Payments integration (Stripe — premium tier unlock)
- P1: Real push notifications (PWA service worker or mobile-native)
- P2: Additional features (only if requested; guardrails apply)

## Phase 4: Paywall UI + Profile Polish (Complete — Apr 2026)
- PaywallModal bottom sheet: free vs premium comparison, disabled "Upgrade" CTA (payments TBD)
- Dashboard: amber upgrade banner when at 3/3 limit; Add button opens paywall when full
- AddProduct: 403 limit error → PaywallModal (not raw error text)
- Profile: Google avatar from Supabase user_metadata.avatar_url, plan info card, upgrade button
