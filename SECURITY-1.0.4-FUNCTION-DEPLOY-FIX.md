# VolleyCore Security 1.0.4 — Netlify user-delete function deployment fix

## Fix
- Replaced `admin-delete-user.mjs` with a new standalone Netlify Function:
  `admin-user-delete.mjs`
- The function no longer imports `_firebase-rest.mjs`; all required server logic is contained in the function itself.
- Frontend endpoint updated to `/.netlify/functions/admin-user-delete`.
- Existing ONVO functions are untouched.

## Expected Netlify result
After deploying this version, Netlify should show 4 functions:
1. `_firebase-rest`
2. `onvo-create-checkout`
3. `onvo-webhook`
4. `admin-user-delete`

## Commit
UI 2.14.4 - fix secure user deletion function deployment
