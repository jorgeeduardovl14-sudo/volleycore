# VolleyCore UI 2.13.1 — Finance UX + Dark Mode Audit

## Scope implemented

### Payment control center
- Reworked Admin > Pagos into a financial control center.
- Added KPI/filter cards:
  - Pendientes
  - Morosos
  - Pagados este mes
  - Requieren revisión
- Each card shows count + total amount and filters the account-status table.
- Added filters by player search, month and category.
- Main table now shows:
  - Jugadora
  - Categoría
  - Estado
  - Cuota
  - Pagado
  - Saldo
  - Vencimiento
  - Ver
- Existing SINPE review inbox, report generator and ONVO admin section remain available below the control center.

### Dashboard deep links
- "Pagos pendientes" now opens Pagos with the Pendientes filter already active.
- "Morosas" now opens Pagos with the Morosos filter already active.
- This removes the previous extra filtering step.

### Player profile
- Número de cédula / identificación moved to the top "Información deportiva" block, directly after Fecha de nacimiento.
- It remains persisted through `identificationNumber`.
- "Seleccionada Nacional" remains available.
- Mayor/Menor de edad remains removed.

### Dark mode
- Expanded application-wide contrast rules for legacy/module-specific text.
- Added explicit coverage for:
  - headings/body text
  - muted/help/hint/payment metadata
  - panels/stats/reports/notices/details
  - payment center cards and table
  - primary/secondary/actions
  - semantic badges
  - dialogs and standalone field labels
- Views detected and covered by the application-wide `.view` dark-mode layer: 33
- View IDs: dashboard, trainerPending, players, categories, seasons, trainings, events, venues, announcements, finances, sinpeAdmin, users, userAdmin, shirtAdmin, attendance, trainerAttendance, reports, import, familyHome, familyCategories, familyLink, familyTrainings, familyEvents, familyPayments, familyAnnouncements, about, trainers, trainerHome, trainerPlayers, trainerTrainings, trainerEvents, trainerAnnouncements, profile

### Protected functionality
- ONVO Netlify Functions: unchanged.
- Firebase REST helper: unchanged.
- Shirt request workflow: unchanged.
- Authentication/roles: unchanged.
- Firestore rules: unchanged from UI 2.13.

## Validation
- `node --check app-ui-2.13.1.js`: PASS
- HTML duplicate ID audit: PASS
- JS selector-to-HTML audit: PASS
- Payment center required controls: PASS
- Dashboard payment deep-link logic: PASS
- Player identification field: PASS
- Dark-mode global/module coverage layer: PASS

## Testing note
This is a code-level/full-module contrast audit. Visual testing should still be performed in the Deploy Preview on desktop and mobile in both light and dark mode before merging to `main`.
