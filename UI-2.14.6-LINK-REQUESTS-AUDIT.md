# VolleyCore UI 2.14.6 — Linking request workflow

## Fixed
- Parent/family linking request now creates an Admin-targeted notification.
- Notification appears in the bell for Admin users.
- Clicking the notification opens the dedicated Linking Requests module.
- Request submission remains successful even if notification creation fails; failure is logged.

## New Admin module
Administration > Solicitudes de vinculación
- Pending requests default view
- All / Approved / Rejected filters
- Search by requester, player, Player ID or relationship
- Category filter
- Submitted timestamp
- Processor identity
- Approve / Reject actions
- Pending-count badge in sidebar

## History
- Approval records `approvedBy` and `approvedAt`.
- Rejection records `rejectedBy` and `rejectedAt`.
- Existing link-request history remains retained.

## Security
Firestore notification rules changed only to allow a portal user to create:
- kind = link_request
- targetRole = admin
- createdBy = authenticated UID
- empty categoryId
- string sourceId

## Deployment
- `firestore.rules` changed and MUST be published before testing the parent-created notification.
- No Storage rule changes.
- ONVO, App Check and payment functions unchanged.

## Commit
UI 2.14.6 - fix linking notifications and add admin link requests module
