# VolleyCore UI 2.14.23 — Event permissions and audit

## Event deletion
- Admin and Super Admin can delete events.
- Trainer/assistant can delete events only when the event primary category belongs to their assigned categories.
- Firestore rules now enforce this server-side; this is not only a UI permission.

## Event creator
- New manually created and PDF-imported events store `createdByName` in addition to existing `createdBy` and `createdByRole`.
- Event detail displays creator and role.
- Legacy events fall back to the user directory when available, current profile when self-created, or role label.

## Deletion notification
- After a successful event deletion, VolleyCore creates an `event_deleted` notification for every category associated with the event.
- Notification identifies event/date/time and who deleted it.

## Deployment
This release changes `firestore.rules`; publish the included rules after deploying the UI.

## Commit
UI 2.14.23 - event delete permissions creator audit and delete notifications
