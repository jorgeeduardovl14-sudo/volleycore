# VolleyCore UI 2.9.1 — User Administration Hotfix

## Root cause
- Role management was incorrectly embedded inside the Families module.
- The "Gestionar rol" buttons rendered with `data-manage-role`, but the delegated body click selector did NOT include `[data-manage-role]`.
- Therefore clicking the visible button did nothing.

## Fix
- Added dedicated Admin navigation item: "Administración de usuarios".
- Added independent `view-userAdmin`.
- Removed the registered-user role table from Families.
- Added user search, role filter and status filter.
- Added user summary metrics.
- Added working "Gestionar rol" buttons.
- Added `[data-manage-role]` to the delegated event selector.
- After saving a role, VolleyCore returns to Administration de usuarios and refreshes the table.

## Security
- Firestore role security remains from UI 2.9: only role=admin can change roles.
- No Storage rule changes.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Dedicated user admin view: PASS.
- data-manage-role delegated click selector: PASS.
