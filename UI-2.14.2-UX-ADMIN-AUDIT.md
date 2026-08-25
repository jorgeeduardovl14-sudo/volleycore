# VolleyCore UI 2.14.2 — UX/Admin changes

## Changes
1. First Division financial state
   - Player cards/details show only `Primera División`.
   - Removed redundant `Sin mensualidad` wording.

2. Trainer module summary
   - Summary boxes are clickable.
   - Filters: pending requests, all sports staff, active, trainers, assistants.
   - Selected box is visually indicated.

3. Player deletion
   - Admin-only `Eliminar jugadora` button added to Edit Player and Player Detail.
   - Requires explicit confirmation.
   - Deletes:
     - `players/{playerId}`
     - `playerPrivate/{playerId}`
   - Removes the player from family `playerIds`.
   - Clears `users.playerId` references.
   - Existing financial records are intentionally retained for audit/history.
   - Firestore rules now allow Admin delete for `players` and `playerPrivate`.

## Unchanged
- App Check / reCAPTCHA Enterprise
- ONVO
- Storage rules
- Payment history and charge records
- Role model and trainer private-data category restrictions
