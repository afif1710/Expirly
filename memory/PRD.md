# Expirly PRD — Push Scheduler Phase

## Original Problem Statement
Implement only the scheduler phase for the existing web-push flow: add a small backend scheduler that automatically runs the existing due-reminder sweep logic on an interval, reuse the existing sweep logic, keep duplicate-send protection and dead-subscription cleanup working as-is, and add only the minimal startup/shutdown wiring needed.

## Current Architecture Decisions
- Real repo confirmed as Expirly: React 18 + TypeScript + Vite frontend, FastAPI + MongoDB backend.
- Real auth confirmed as Supabase Auth on the frontend with backend Bearer-token validation via existing `get_current_user` dependency.
- Push subscription storage uses the existing MongoDB layer in a dedicated `push_subscriptions` collection.
- Frontend keeps the repo’s current env convention by fetching the VAPID public key from the backend instead of introducing a new frontend env variable.
- New backend env names expected for this phase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL`.

## What’s Implemented
- Existing subscription setup layer remains intact: service worker, frontend subscription flow, VAPID public-key endpoint, subscribe/unsubscribe endpoints, and MongoDB `push_subscriptions` storage.
- Added backend web-push delivery using `pywebpush` against stored browser subscriptions.
- Added minimal backend sweep logic via `POST /api/notifications/sweep` so due reminders can be sent manually now and reused by a future scheduler later.
- Added an automatic backend scheduler loop that calls the existing sweep logic immediately on startup and then every 300 seconds.
- Added minimal FastAPI lifecycle wiring to start the scheduler on app startup and cancel it cleanly on shutdown.
- Added duplicate-send protection with claim + sent timestamps on products:
  - `reminder_push_claimed_at`
  - `reminder_push_sent_at`
- Added dead-subscription cleanup: 404/410 web-push failures remove invalid subscriptions from MongoDB.
- Reset push-send markers when a product reminder is changed so a newly scheduled reminder can send later.
- Restored a missing backend `.env` file with documented local Mongo/Supabase URL defaults so the backend can boot in this repo state.

## Prioritized Backlog
### P0
- Set real `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_CLAIMS_EMAIL` values in the runtime environment.
- Set the real `SUPABASE_ANON_KEY` in `backend/.env` or runtime env if API fallback validation is needed.

### P1
- Add backend tests for sweep, duplicate prevention, and dead-sub cleanup.
- Add explicit unsubscribe-on-logout or permission-revoke cleanup flow if requested.

### P2
- Quiet hours and per-user push preferences.
- Delivery analytics and history.
- Retry/backoff policies.

## Next Tasks
- Configure the real VAPID values and optional real Supabase anon key in runtime env.
- Call `POST /api/notifications/sweep` from a scheduler when ready.
- Add automated tests around the sweep path and push cleanup behavior.
