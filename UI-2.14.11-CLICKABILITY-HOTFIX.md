# UI 2.14.11 Clickability Hotfix

This hotfix addresses two interactions reported as non-functional in UI 2.14.10.

## Mensualidades
- Summary cards now use a dedicated `financeSummary` delegated click listener.
- Clicking Pagado, Pendiente or Morosos updates the status selector and re-renders the table.
- Monthly charge rows now have a dedicated `chargesBody` click/keyboard listener that opens the existing charge editor.
- Added visible selected state to the active summary filter.

## Bitácora de bajas
- `offboardingList` now owns its click and keyboard listeners directly.
- Clicking anywhere on a record card opens the read-only detail dialog.
- This no longer depends on the generic document click listener.

## Scope
No Firestore rule, payment, ONVO, App Check, Storage, or data-model changes in this hotfix.

## Commit
UI 2.14.11 - hotfix finance and offboarding card click actions
