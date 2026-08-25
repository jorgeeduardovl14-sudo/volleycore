# VolleyCore Security 1.0 — deployment sequence

This release separates sensitive player data from `players` into `playerPrivate`.

## Important rollout order
1. Deploy the application code and Firestore/Storage rules from this package to Develop/Deploy Preview.
2. Sign in to the preview with an **admin** account. The first admin load automatically migrates legacy sensitive fields from each `players/{id}` document into `playerPrivate/{id}` and removes those fields from the public player document.
3. In Firestore, verify that `playerPrivate` exists and spot-check several records. Confirm `players` no longer contains: identificationNumber, phone, email, province, cantonDistrict, address, emergencyContact, insured, insurance, guardians.
4. Test Admin, Treasurer, Trainer, Guardian and Player accounts before merging to main.
5. Only after the role tests pass, merge to main.
6. Keep Firebase App Check in Monitoring during this migration. Enable Enforcement separately after verified-request coverage is stable.

## Access model introduced
- Admin: public + private player data.
- Treasurer: public player identity/category + financial collections; no `playerPrivate`.
- Trainer/assistant: public players in assigned categories; no `playerPrivate`.
- Guardian/player: public + private only for linked/self player records.
- Player photos: admin, linked guardian/player, or trainer assigned to that player's category.

## Rollback note
Do not roll back only the frontend after migration. Once private fields have moved, an older frontend expects those fields in `players`. Roll back code and data model together if ever required.
