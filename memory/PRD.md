# Expirly PRD — Push Subscription Setup Layer

## Original Problem Statement
Implement only the first part of push notifications for this repo: add a browser notification service worker, extend the frontend permission flow to register the worker and create a push subscription, send that subscription to the backend, add backend request models and endpoints for VAPID public key / subscribe / unsubscribe, and store subscriptions in the repo’s real current database layer. Do not implement delivery, schedulers, reminder firing, tracking, retries, quiet hours, or unrelated fixes.

## Current Architecture Decisions
- Real repo confirmed as Expirly: React 18 + TypeScript + Vite frontend, FastAPI + MongoDB backend.
- Real auth confirmed as Supabase Auth on the frontend with backend Bearer-token validation via existing `get_current_user` dependency.
- Push subscription storage uses the existing MongoDB layer in a dedicated `push_subscriptions` collection.
- Frontend keeps the repo’s current env convention by fetching the VAPID public key from the backend instead of introducing a new frontend env variable.
- New backend env names expected for this phase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL`.

## What’s Implemented
- Added browser service worker at `frontend/public/sw.js` with install/activate/push/click handlers.
- Extended frontend notification permission flow to register the service worker, create/reuse a browser `PushSubscription`, and POST it to the backend after permission is granted.
- Added backend request/response models for VAPID key and push subscription payloads.
- Added backend endpoints:
  - `GET /api/notifications/vapid-public-key`
  - `POST /api/notifications/subscribe`
  - `DELETE /api/notifications/unsubscribe`
- Added MongoDB persistence for push subscriptions with indexes on `(user_id, endpoint)` and `user_id`.

## Prioritized Backlog
### P0
- Add actual web-push delivery using stored subscriptions and VAPID private key.
- Handle expired/invalid subscriptions during send and auto-clean them up.

### P1
- Wire reminder firing logic to stored products/reminder times.
- Add unsubscribe cleanup on logout or explicit browser revocation flow.
- Add backend tests for subscribe/unsubscribe and VAPID-key endpoint behavior.

### P2
- Quiet hours and per-user push preferences.
- Delivery metrics / push sent tracking.
- Retry policies and background scheduling.

## Next Tasks
- Configure the three VAPID env vars in the runtime environment.
- Implement actual push sending only when the next phase is requested.
- Add automated API and frontend tests around the new subscription setup flow.
