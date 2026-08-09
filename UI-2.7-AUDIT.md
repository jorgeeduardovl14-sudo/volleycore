# VolleyCore UI 2.7 — Mobile, Away Venues & Role-Aware Notifications

## 1. Mobile UX
- Notification bell visible on mobile.
- Bell reduced and refined on desktop/mobile.
- Mobile header, nav, filters, cards, tables, forms and dialogs receive dedicated responsive behavior.
- Previous CSS rule hiding the bell under 680px is overridden.

## 2. Away event venues
- 'Visita' renamed to 'Visitante'.
- Visitor events use a dedicated external gym/place and address.
- Waze/Maps URL remains available.
- Event details, trainer event cards and category event views show visitor place/address instead of 'Sin sede'.

## 3. Notifications for all roles
- Admin/Treasury: all notifications.
- Trainer/Assistant: assigned categories.
- Family: categories of linked players.
- Player account/role: own linked player categories, including primary and reinforcement categories.
- Future separate role='player' supported.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Mobile bell visibility: PASS.
- Away venue fields: PASS.
- Player primary/reinforcement notification filtering: PASS.
- Firestore and Storage rules unchanged from UI 2.6.
