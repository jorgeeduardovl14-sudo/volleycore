# VolleyCore UI 2.12.2 — ONVO Server Runtime Fix

## Root cause
Netlify Function crashed before reaching ONVO:
`require() of ES Module ... node_modules/jose/...`

This came from the Firebase Admin dependency chain, not from VolleyCore's ONVO checkout code.

## Fix
- Removed `firebase-admin` from ONVO Netlify Functions.
- Removed the `jose` dependency path entirely.
- Firebase user validation now uses the official Firebase Auth REST `accounts:lookup` endpoint.
- Firestore reads/writes now use the official Cloud Firestore REST API.
- Service-account OAuth tokens are generated with Node's native `crypto` module (RS256); no external auth/JWT package.
- ONVO Checkout and webhook code remain server-side.
- Webhook writes use atomic Firestore commit requests and duplicate-event preconditions.

## Required Netlify variable added
`FIREBASE_WEB_API_KEY`

Find it in Firebase > Project settings > General > Your apps > Web API Key.

Existing variables retained:
- ONVO_SECRET_KEY
- ONVO_WEBHOOK_SECRET
- FIREBASE_SERVICE_ACCOUNT_B64

The old FIREBASE_PRIVATE_KEY / CLIENT_EMAIL / PROJECT_ID are no longer used by the ONVO Functions and may be removed after successful testing.

## Rules
No Firestore or Storage rule changes in this runtime hotfix.
