# Nudgly – Push Notifications Sprint Plan

**Purpose:** Push notification epics extracted from the MVP Sprint Plan. These epics cover external provider setup and device registration/delivery.

---

## Epic 13a: Push Notification Dependencies — External Setup

**Objective:** Set up all external provider accounts and credentials required for push notifications so Epic 13b is not blocked by external dependencies.

> **Start this epic early (in parallel with Epics 9–12).** These are external dependencies with lead times (Apple Developer review, Firebase project setup, etc.).

### Setup Checklist
- **Firebase:** Create Firebase project; enable Cloud Messaging (FCM v1 API). Generate service account key for backend. Note: FCM is used for both Android and iOS push delivery.
- **Apple Developer:** Ensure Apple Developer Program membership is active. Create APNs key (`.p8`) or certificate; upload to Firebase for FCM-to-APNs relay. Configure App ID with Push Notifications capability.
- **Google Play (optional for MVP):** If distributing Android builds, create Google Play Console app entry. Not strictly required for push — FCM works without Play Store listing during development.
- **Environment:** Add `FIREBASE_SERVICE_ACCOUNT_KEY` (path or JSON) to `.env.example` and backend settings. Document required env vars in `.docs/be_docs.md`.

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic 13b: Push Notifications & Device Registration

**Objective:** Register device token with FCM; nudge engine sends push to user devices; token cleanup on invalid/unregistered.

**Depends on:** Epic 13a (credentials), Epic 8 (nudge engine worker).

### Backend
- DeviceTokens: user_id, device_id, platform (ios/android/web), token. `POST /device/register` (auth; body: platform, token, optional device_id). One token per (user_id, device_id); replace on re-register.
- Worker: when sending nudge, resolve user's device tokens and send via FCM. On FCM invalid/unregistered, remove token.
- **Friend-linked task notifications:** When a task with linked friends is completed or becomes overdue, send a push notification to each linked friend's devices. Notification type should be distinguishable from standard nudges (e.g. "Your friend completed [task]" or "[task] assigned to [owner] is overdue").
- Rate limiting: per-user caps on nudges per hour/day per §12.

### Frontend
- Request notification permission; obtain FCM token (Capacitor plugin or web FCM SDK). Call `POST /device/register` with platform and token (and device_id if available). Handle foreground/background per platform.

### Implementation Notes:
*(To be completed when epic is done.)*
