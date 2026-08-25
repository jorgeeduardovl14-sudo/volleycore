# VolleyCore UI 2.14.7 — Parent monthly fees + dark mode

## Parent / Encargado > Mensualidades
Default view is now `Pendientes`.

Visible by default:
- pending charges
- overdue charges
- partial charges
- reported payments still awaiting confirmation

Hidden from the default view:
- paid charges
- exempt charges

`Historial` provides access to all records with filters by:
- status
- player
- month

When ONVO changes a charge to paid and the existing realtime Firestore listener receives the update,
the charge no longer matches the Pending view and disappears from that view automatically.

## Dark mode
Added a final contrast-hardening layer for dynamic and legacy module content.
- panels/cards
- tables
- family monthly-fee cards
- filters
- dynamic text
- labels and values
- secondary text
- status badges
- buttons

Brand header colors remain intentionally unchanged.

## No backend/security changes
- Firestore rules unchanged
- Storage rules unchanged
- App Check unchanged
- ONVO functions unchanged

## Commit
UI 2.14.7 - focus parent monthly fees and harden dark mode contrast
