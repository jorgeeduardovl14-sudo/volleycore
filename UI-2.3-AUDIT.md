# VolleyCore UI 2.3 — Three Focused Fixes

## 1. Trainer events
- Fixed the trainer Events module runtime bug: it referenced an undefined `eventCard` renderer.
- Trainer events now render with a dedicated card component.
- Events remain restricted to the trainer/assistant assigned category IDs.
- Event cards can open event details.
- Event edit controls remain admin-only.

## 2. Admin assignment of existing guardians
- The player editor already had registered-family-user checkboxes, but those links were separate from the visible `guardians` data.
- Selected existing users now synchronize into the player's guardian/contact records.
- Admin can assign registered users directly without waiting for a family-link request.
- Existing manual guardian records remain supported.
- Linked user IDs remain the access-control link for family portal access.

## 3. Full dark-mode internal audit
- Added dark-theme coverage for player/category editors, trainer permissions, dialogs, guardian rows, check lists, family/member rows, form controls, notices and internal panels.
- Removes black text and white internal surfaces that remained inside modules.
- Approved white top header behavior remains unchanged.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Broken trainer `eventCard` reference removed: PASS.
- Guardian registered-user synchronization present: PASS.
- Firestore rules unchanged from UI 2.2.
