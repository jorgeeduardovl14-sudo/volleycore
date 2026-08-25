# VolleyCore UI 2.14.20

## Calendar grouping
- Multiple sports events for the same category on the same date are shown inside ONE competition-day card.
- Each individual match/festival inside the grouped card remains separately clickable/editable.
- Applied in Week and Month views.
- Training occurrences remain separate unless suppressed by the existing match-over-training rule.

## PDF Casa / Visita correction
For PDF imports, Casa/Visita is NOT derived from the Equipo Casa / Equipo Visita columns.
The venue is authoritative:
- `Liceo de Santa Barbara` => Casa
- any other venue => Visita
Normalization is accent/case insensitive through VolleyCore `norm()`.

## Existing imported PDF events
Calendar icons/labels also use `sourceVenueName` when present, so previously imported PDF matches display Casa/Visita using the corrected venue rule without requiring re-import.

## No changes
- Firestore rules
- ONVO/payments
- Super Admin governance
- Storage/App Check

## Commit
UI 2.14.20 - group same-day category events and derive PDF home away from venue
