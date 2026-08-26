# UI 2.14.27 — Finance Tabs & Category Detail Fix

Base: Security 1.0.23 / UI 2.14.26

Implemented:
- Reorganized Finance into tabs: Resumen, Mensualidades, Ingresos, Gastos, Conciliación.
- Added global From/To month range and category filter across Finance.
- Monthly dues now support a multi-month period rather than one month only.
- Summary and sponsor income respect the selected period; fixed monthly expenses are projected across the selected number of months.
- Fixed Categories > Ficha not opening (undefined categoryId introduced in UI 2.14.26).
- Category detail now groups same-date, same-category, same-venue matches as FESTIVAL, consistent with Calendar and Upcoming Events.

Parking lot unchanged:
- Mandatory email verification.
- MFA / TOTP.
