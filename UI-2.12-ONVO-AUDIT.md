# VolleyCore UI 2.12 — ONVO Sandbox Integration

## Scope
- Hosted ONVO Checkout for outstanding monthly charges.
- Firebase-authenticated Netlify Function creates checkout sessions.
- ONVO secret key never enters browser code.
- Webhook verifies X-Webhook-Secret.
- Idempotent webhook event processing.
- Successful checkout updates Firestore charge paidAmount/status automatically.
- Server-side ONVO payment record collection.
- Admin Payments page includes ONVO Sandbox transaction list.
- Family charge cards show ONVO state and test payment button.
- Existing manual SINPE reporting remains unchanged.

## Safety
- Integration blocks live ONVO keys unless ONVO_ALLOW_LIVE=true.
- Checkout function verifies Firebase ID token and charge ownership.
- Return URLs restricted to HTTPS Netlify/current site origins.
- Firestore client rules do not allow creating/updating onvoPayments.
- Firebase Admin credentials are expected only as Netlify environment variables.

## Required Netlify environment variables
- ONVO_SECRET_KEY
- ONVO_WEBHOOK_SECRET
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

## Required ONVO webhook URL
https://YOUR_SITE/.netlify/functions/onvo-webhook

## Validation
- Frontend JavaScript syntax: PASS
- Netlify function JavaScript syntax: PASS
- HTML selector audit: PASS
- Firestore rules updated for onvoPayments read-only client access
- Node 22 configured
- firebase-admin 14.2.0 pinned
