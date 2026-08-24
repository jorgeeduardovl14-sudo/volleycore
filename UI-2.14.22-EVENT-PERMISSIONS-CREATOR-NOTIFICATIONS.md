# UI 2.14.22

## Event permissions
- Admin and Super Admin can edit/delete any event.
- Trainers can edit/delete events only when the event belongs to their assigned category.
- UI and Firestore rules both enforce this.

## Event creator visibility
- Event cards show who created the event.
- New events store `createdByName` in addition to UID/role.

## Event deletion notifications
- Deleting an event creates a category notification for each affected category.
- Notification includes event title/date/time and who deleted it.
- Deletion is also written to adminAudit when possible.

## Scope
- No ONVO/payment changes.
- No Storage/App Check changes.

## Commit
UI 2.14.22 - allow scoped trainer event deletion and add creator/deletion notifications
