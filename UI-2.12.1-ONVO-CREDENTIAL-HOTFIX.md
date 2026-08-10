# VolleyCore UI 2.12.1 — ONVO Firebase Credential Hotfix

## Problem
Netlify/Firebase Admin returned:
`Failed to parse private key ... DECODER routines::unsupported`

## Fix
The Netlify Functions now prefer:
`FIREBASE_SERVICE_ACCOUNT_B64`

This variable contains the complete Firebase service-account JSON encoded as Base64. It avoids PEM newline, escaping, quote, and partial-copy problems.

The old `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` method remains only as a fallback.

## No database-rule changes
Firestore and Storage rules are unchanged in this hotfix.
