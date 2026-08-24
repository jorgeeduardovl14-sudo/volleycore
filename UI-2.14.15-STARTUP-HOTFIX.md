# UI 2.14.15 — Startup hotfix

## Root cause
The UI 2.14.14 Trainings redesign replaced the code range from `renderTrainings()` up to `renderEvents()`.
That range also contained three existing functions used elsewhere:
- `renderFamilyTrainings()`
- `eventAdminCard()`
- `dateDaysAgo()`

Because `renderFamilyTrainings` is referenced by the global view renderer map during script initialization,
the browser raised a ReferenceError before the normal Firebase/bootstrap flow could complete. The visible symptom
was VolleyCore remaining indefinitely on "Cargando información con Firebase".

## Fix
Restored the three original functions exactly from UI 2.14.13.
No redesign logic was removed.
No Firestore rules, ONVO, payment logic, App Check, or Storage rules changed.

## Validation
- Node syntax check
- required recovered functions present
- global renderer references resolved
- DOM ID/selector validation

## Commit
UI 2.14.15 - restore removed shared functions after trainings redesign
