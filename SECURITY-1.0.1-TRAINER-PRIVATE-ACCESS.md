# VolleyCore Security 1.0.1 — Trainer private-data access

## Approved policy
An active Trainer/Assistant may read private data only for players whose `categoryIds`
intersect the trainer's `assignedCategoryIds`.

Private data includes:
- Identification / cédula
- Player phone and email
- Province / district / full address
- Guardians
- Emergency contact
- Insurance information

A trainer cannot read `playerPrivate` for players outside assigned categories.

## Implementation
- `playerPrivate` now stores `categoryIds` as authorization metadata.
- Admin migration copies `categoryIds` into each private document.
- Player edit keeps private `categoryIds` and `linkedUserIds` synchronized.
- Category roster edits synchronize `playerPrivate.categoryIds`.
- Guardian approval synchronizes `playerPrivate.linkedUserIds`.
- Trainer portal loads private documents only after obtaining the already-authorized roster.
- Player detail exposes private data to:
  - Admin
  - linked family / the player herself
  - assigned Trainer/Assistant
- Treasurer is intentionally not granted private-data access.
- Trainer financial data remains separately controlled by `viewFinancialStatus`.

## Firestore rule
`playerPrivate/{playerId}` allows trainer reads only when:
- user role is trainer/assistant and active
- organization is ASBAVOL
- private document contains `categoryIds`
- at least one category is assigned to that trainer

## Unchanged
- App Check
- ONVO server functions
- Storage rules (player-photo trainer restriction already follows assigned categories)
- Payment write permissions

## Required deployment
`firestore.rules` changed and must be published for this version.
`storage.rules` did not change.

## Validation expectations
- Trainer A reads private data for own-category player: ALLOW
- Trainer A reads private data for another-category player: DENY
- Treasurer reads playerPrivate: DENY
- Linked guardian reads own playerPrivate: ALLOW
- Different guardian reads playerPrivate: DENY
- Admin reads/writes playerPrivate: ALLOW
