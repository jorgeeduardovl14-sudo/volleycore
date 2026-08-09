# Sprint 1 - Families and Player Profiles

## Goal

Correct the family model and make each linked player independently accessible without affecting authentication or existing administrative modules.

## Approved decisions

- Family display name is editable.
- Family code is unique and permanent.
- Users and players are separate entities.
- A family may contain multiple users and players.
- A player may belong to multiple categories.
- One category remains the primary category.
- Financial information is hidden from athlete accounts.

## Delivery sequence

1. Data compatibility helpers.
2. Family dashboard and family detail view.
3. Multiple categories in player form.
4. Independent player profile.
5. Real-time link synchronization.
6. Regression testing in `develop`.
7. Merge to `main` only after approval.
