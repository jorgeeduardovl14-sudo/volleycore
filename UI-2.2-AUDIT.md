# VolleyCore UI 2.2 — Three Focused UX Fixes

## 1. Dark mode contrast
- Full text/surface contrast override for dark theme.
- Removes black-on-dark text across modules, tables, forms, dialogs and cards.
- Approved white header remains white with dark branding text.

## 2. Players module
- No roster is shown on first entry.
- User must select a category or "Todas las categorías".
- Search/status filters continue to work after category selection.

## 3. Dashboard events + location links
- Upcoming dashboard events are clickable and keyboard accessible.
- Clicking opens a read-only event detail dialog.
- Event editor now stores a dedicated location URL.
- Waze / Google Maps / HTTPS links render as a clickable "Abrir ubicación / Waze" button.
- Existing event fields and business logic remain intact.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Firestore rules unchanged from UI 2.1.2.
