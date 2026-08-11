# VolleyCore UI 2.13.2

Implemented:
- Shirt request modal closes after successful submission.
- Shirt sizes standardized: XS, S, M, L, XL.
- Admin product photos for Camisa de aficionado and Uniforme de Iniciación using Firebase Storage.
- Product photo displayed in request dialog.
- National-team indicator uses an inline SVG Costa Rica flag, avoiding OS/browser emoji dependence.
- Injured players use a red SVG medical cross and "Lesionada".
- Both indicators are visible in the all-players table and player detail.
- Injured status translated to "Lesionada".
- Dark-mode semantic contrast strengthened for status badges and new store elements.
- Previous UI 2.13.1 payment-control redesign retained.
- ONVO Netlify functions unchanged.

Files requiring publication:
- firestore.rules changed: shirtCatalog permissions.
- storage.rules changed: shirtCatalog image path permissions.

Validation:
- JavaScript syntax PASS.
- Duplicate HTML IDs PASS.
- JS selector/HTML ID audit PASS.
