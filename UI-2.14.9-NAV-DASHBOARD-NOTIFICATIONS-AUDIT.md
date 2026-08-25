# VolleyCore UI 2.14.9

## Scope implemented
1. Interaction/clickability consistency
- Administration of Users rows are fully clickable.
- User Admin summary cards now act as filters.
- Dashboard feature cards are fully clickable and keyboard accessible.
- Existing entity cards/buttons remain intact; nested controls are preserved.
- Added shared hover/focus affordances for clickable cards/rows/stats.

2. Admin Dashboard role cleanup
- Removed `Solicitud de camiseta` from Admin Home.
- Shirt request functionality remains available in roles/views where it belongs.

3. Dashboard sports summary
- `PRÓXIMO PARTIDO` -> `PRÓXIMOS PARTIDOS`.
- Shows up to 5 future matches ordered chronologically.
- Entire card navigates to Events.
- `PRÓXIMO ENTRENAMIENTO` -> `ENTRENAMIENTOS`.
- Shows configured recurring schedules, category count and the next calculated session.
- Entire card navigates to Trainings.

4. Notification cleanup
- Individual × hides a notification for the current user.
- `Limpiar leídas` hides all read notifications for the current user.
- `Marcar todas como leídas` remains.
- Operational source records are not deleted.
- Bell count remains unread-only.

## QA
- JavaScript syntax validation.
- DOM selector validation.
- Duplicate ID validation.
- Dark-mode styles added for all newly introduced interactive elements.

## Backend
No new collections or security-rule changes in this UI release. Existing notification update permission is reused for `hiddenBy`.

## Commit
UI 2.14.9 - unify clickable navigation and improve admin dashboard notifications
