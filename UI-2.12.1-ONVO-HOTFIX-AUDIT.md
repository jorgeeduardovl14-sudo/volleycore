# VolleyCore UI 2.12.1 — ONVO Function Hotfix

## Root cause
Netlify Function invocation failed before reaching ONVO with:
ERR_REQUIRE_ESM
`jwks-rsa` attempted to require ESM-only `jose`.

## Hotfix
- Pinned `firebase-admin` from 14.2.0 to 13.10.0.
- Kept Node 22.
- Kept Netlify Functions as `.mjs` ESM.
- No changes to ONVO keys, webhook URL, webhook secret, Firebase service account, Firestore data model, UI payment flow, or Storage rules.

## Expected result
`onvo-create-checkout` should initialize Firebase Admin successfully and proceed to the ONVO checkout API request instead of failing during module loading.

## Validation
- package.json: firebase-admin 13.10.0
- Frontend JavaScript syntax: PASS
- Netlify function syntax: PASS
- HTML selector audit: PASS
