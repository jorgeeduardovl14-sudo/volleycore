# VolleyCore UI 2.14.18 — Governance, venues and category calendar import

## 1. Super Administrator governance
- Uses existing `role: admin` plus protected boolean `isSuperAdmin: true`.
- Normal Admin cannot modify or delete another Admin.
- Normal Admin cannot assign Admin role.
- Super Admin can manage normal Admin accounts.
- Super Admin accounts cannot be deleted, deactivated or demoted from the VolleyCore UI.
- Sensitive role changes and calendar imports create immutable `adminAudit` records.
- Backend `admin-user-delete` also enforces Admin/Super Admin protection.

### IMPORTANT FIRST-TIME BOOTSTRAP
For security, this release does NOT allow an Admin to promote themselves to Super Admin.
After deploying Firestore rules, use Firebase Console once to set:
`users/<your-admin-uid>.isSuperAdmin = true`
on the intended principal administrator.
This prevents self-elevation attacks.

## 2. Gimnasios / sedes
- Added Delete.
- Confirmation required.
- Delete is blocked while categories, training series, or events reference the venue.
- Firestore venue deletion remains Admin-only.

## 3. Calendar import by category
- Admin category detail now opens an Import Calendar workflow.
- Family category detail keeps the existing calendar download behavior.
- Supports XLSX/XLS/CSV using the XLSX reader already present in VolleyCore.
- Downloadable Excel template.
- Preview before write.
- Validates date, start time, Casa/Visita and registered home venue.
- Detects likely duplicates and omits them.
- Imported records become normal `events`, so the sports calendar updates from the existing event data path.
- Columns: Fecha, Inicio, Fin, Tipo, Rival, Casa/Visita, Sede, Direccion, Notas.

## Scope
No ONVO/payment/App Check/Storage changes.

## Commit
UI 2.14.18 - add super admin governance venue deletion and category calendar import
