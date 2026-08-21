# VolleyCore UI 2.14.10

## Notifications
Fixed persistence for per-user notification cleanup.
Firestore Rules now allow a signed-in user to append only their own UID to `hiddenBy`, while preserving existing values.
The same restrictive pattern remains for `readBy`.
Notification documents are not deleted.

Expected:
- X individual remains hidden after refresh/login.
- Limpiar leídas remains hidden after refresh/login.
- Bell counter remains unread-only.

## Mensualidades
- Summary boxes are clickable and apply the relevant status filter.
- Monthly-charge rows are fully clickable and open the existing edit/detail flow.

## Asistencia
- Existing bulk-present action is now clearly labeled:
  `Seleccionar todas · Presentes`
- Applied to both Admin and Trainer attendance.

## Bitácora de bajas
- Entire record cards are clickable.
- Opens a dedicated read-only detail dialog.

## Solicitudes de camisetas
- Entire Admin request cards are clickable.
- Opens a dedicated read-only detail dialog.
- Embedded status selector remains independently usable.

## Deployment
`firestore.rules` CHANGED and must be published.
Storage rules, ONVO functions, App Check and payment logic are unchanged.

## Commit
UI 2.14.10 - fix notification persistence and complete interaction consistency
