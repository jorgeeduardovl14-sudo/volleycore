# VolleyCore UI 2.13.4 — Firebase App Check integration

## Change
Firebase App Check is initialized immediately after Firebase App initialization and before Auth, Firestore, or Storage are instantiated.

Provider:
- reCAPTCHA Enterprise
- Automatic App Check token refresh enabled

## Important deployment requirement
The production reCAPTCHA Enterprise key currently permits `volleycore.netlify.app`.

Before testing this build on PR #6, also add this hostname to the same reCAPTCHA Enterprise key:
`deploy-preview-6--volleycore.netlify.app`

Do NOT disable domain verification.

## Enforcement
Do NOT enable Firebase App Check enforcement yet.
First deploy this build and verify App Check request metrics show valid/verified traffic for Firestore and Storage.

## Unchanged
- ONVO server functions
- Firestore rules
- Storage rules
- roles
- payment workflows
- shirt workflows
- player data model

## Validation
- JavaScript syntax: PASS
- App Check initialized before Firebase service instances: PASS
- auto token refresh: PASS
