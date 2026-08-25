# VolleyCore UI 2.14.5 — Upload verification

After uploading to branch Develop, GitHub > netlify/functions must show exactly these 4 function files:

- _firebase-rest.mjs
- admin-user-delete.mjs
- onvo-create-checkout.mjs
- onvo-webhook.mjs

Do not continue if admin-user-delete.mjs is missing.

Expected Netlify deploy log:
Packaging Functions from netlify/functions directory:
- _firebase-rest.mjs
- admin-user-delete.mjs
- onvo-create-checkout.mjs
- onvo-webhook.mjs

Commit:
UI 2.14.5 - add missing admin user deletion function
