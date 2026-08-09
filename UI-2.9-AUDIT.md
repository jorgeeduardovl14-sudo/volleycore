# VolleyCore UI 2.9 — Events History, Event Contrast & Role Management

## 1. Events organization
- Main Events area shows only today and future events.
- Added "Eventos anteriores" for the last 7 days.
- Existing category, season and event-type filters apply to both sections.
- Older events remain stored in Firestore but do not clutter the active view.
- Trainer Events now shows current/future events rather than mixing old events into the current list.

## 2. Events dark-mode contrast
- Added specific dark-theme surfaces for the Events module.
- Event cards use a lighter dark surface, clearer borders and high-contrast text.
- Past-event cards remain visually secondary but readable.
- Semantic status badges retain their status colors.

## 3. Role management in VolleyCore
- Registered users table now displays all users and their current role.
- Administrator can open "Gestionar rol" directly in VolleyCore.
- Supported roles: Administrador, Tesorería, Entrenador, Asistente, Jugadora and Familia.
- Status can be Active/Inactive.
- Trainer/Assistant category assignments and limited permissions can be configured.
- Player role warns if the user is not linked to a player profile.
- Administrator cannot demote their own account from this UI.
- Explicit role='player' is now recognized as a portal user while legacy family/accountType=player remains compatible.

## Security
- Added `isRoleAdmin()` in Firestore rules.
- Only role='admin' can change another user's role/account type.
- Treasurer retains existing administrative edits only when role/accountType do not change.
- Normal users cannot change their own role/status/account type.
- Firestore portal access now supports explicit player role.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Events active/history split: PASS.
- Role manager UI: PASS.
- Firestore role-change restriction: PASS.
- Storage rules unchanged.
