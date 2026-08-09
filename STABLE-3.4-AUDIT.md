# VolleyCore Stable 3.4 — Gestión Deportiva

## Included
- Category naming migration: Iniciación, U-13, U-15, U-17 Rojo, U-17 Negro, U-19, U-21, Primera División.
- Category metadata: age group and color/group.
- Bulk player import from Excel/CSV with preview, duplicate detection and validation.
- Downloadable Excel import template.
- Attendance module for administrators.
- Attendance module for trainers limited to assigned categories.
- Absence reason and justification note.
- Monthly attendance summary and CSV export for administrators.

## Static validation
Passed 15/15 checks.

## Manual smoke test
1. Login as admin.
2. Confirm category names migrate correctly.
3. Edit a category and verify Grupo de edad / Color.
4. Download the Excel template, import 2 test players, preview, then import.
5. Open Asistencia, choose a category/date, mark attendance, save, reopen and confirm persistence.
6. Mark one player absent and add a reason/note.
7. Login as trainer and confirm only assigned categories appear in Asistencia.
8. Generate the monthly attendance summary.
9. Re-test Categories, Players, Families, Payments and Events before merging to main.
