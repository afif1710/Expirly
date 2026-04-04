# PHASE_2_SUMMARY.md — Expirly Phase 2

## What was built in Phase 2

### 1. Barcode Scanning
- **Library:** `html5-qrcode` v2.3.8 (browser-native, no extra credentials needed)
- **Component:** `frontend/src/components/BarcodeScanner.tsx`
  - Full-screen camera overlay
  - Supports EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, QR formats
  - Graceful error states: camera permission denied, no camera found, general error
  - Auto-stops scanner after first successful detection
  - "Cancel / Enter manually" fallback always visible
- **Works on:** Chrome/Firefox on Android/iOS (camera permission required)
- **Preview/desktop:** Falls back gracefully to manual entry if no camera

### 2. Open Food Facts Integration
- **Service:** `frontend/src/services/openFoodFactsService.ts`
- **Backend proxy:** `GET /api/food/lookup?barcode={barcode}`
  - Proxied via backend to avoid browser CORS issues
  - Calls `https://world.openfoodfacts.org/api/v2/product/{barcode}`
  - Returns: product_name, brand, category
  - 404 if not in database (caller always falls back to manual entry)
  - 503 on network failure (caller falls back gracefully)
- **Auth required:** Yes (standard JWT bearer token)
- **No credentials needed** — Open Food Facts is free and open

### 3. Updated AddProduct flow
- **Barcode section** now at top of product details form (Step 2)
  - "Scan Barcode with Camera" button → opens scanner overlay
  - Manual barcode input + magnifying glass lookup button
  - Auto-lookup triggers immediately after scan
  - Manual lookup triggered by pressing the search icon
- **Product name auto-fill:** If barcode found, fills in product name + shows brand
- **Auto-filled badge:** Product name field shows "(auto-filled)" tag (editable)
- **Status messages:**
  - Green: "Product found · [brand] — name filled in below"
  - Grey: "Not in food database — please enter the name manually"
  - Amber: "Couldn't reach food database — please enter the name manually"
- **All fallbacks always work** — barcode is optional, manual entry always possible

### 4. Phase 1 preservation
- All 13 Phase 1 business rules preserved:
  - Niche-first flow mandatory
  - 3 active product limit
  - Product details locked after save
  - No delete before expiry
  - Default niches protected
- No regression to auth, dashboard, alerts, or profile

---

## Tech decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Barcode library | html5-qrcode | Best browser mobile support, actively maintained |
| Food DB | Open Food Facts | Free, open, no auth needed, large product database |
| CORS strategy | Backend proxy | Avoids browser CORS issues with OFF API |
| Fallback | Always enabled | Network failure or scan failure → manual entry, never blocks user |

---

## Files changed

| File | Change |
|------|--------|
| `backend/server.py` | Added `GET /api/food/lookup` endpoint |
| `frontend/src/pages/AddProduct.tsx` | Full integration of scan + lookup + autofill |
| `frontend/src/components/BarcodeScanner.tsx` | NEW — camera scanner component |
| `frontend/src/services/openFoodFactsService.ts` | NEW — barcode lookup service |
| `frontend/package.json` | Added `html5-qrcode` dependency |
| `MANUAL_SETUP.md` | Added Phase 2 camera + Open Food Facts notes |

---

## Upcoming (Phase 3 / Future)
- Supabase auth swap
- Google OAuth
- Push notifications (real device)
- Payments / premium tier
