# VolleyCore UI 2.10 — Player Profile Linking + Full Dark Mode Audit

## Player role / profile repair
Root cause:
- Assigning role=player did not link the user UID to a document in `players`.
- Portal data is derived from the linked player document, so a role-only account could show:
  - "Sin jugadoras vinculadas"
  - no categories
  - no events
  - no category notifications

Fix:
- Role Manager now shows a mandatory "Ficha de jugadora" selector when role Jugadora is chosen.
- Saving role Jugadora:
  - stores `playerId` on the user profile,
  - links the UID into that player's `linkedUserIds`,
  - synchronizes `assignedCategoryIds` to the player's primary + categoryIds + reinforcement categories,
  - removes that UID from a previously linked player profile when changing the player-account identity.
- Player login uses `profile.playerId` to isolate the correct player profile.
- Categories/events/notifications continue to derive from the player record as the source of truth.

## Full dark-mode audit
Audited 32 application views and 25 dialogs.

Views:
dashboard, trainerPending, players, categories, seasons, trainings, events, venues, announcements, finances, sinpeAdmin, users, userAdmin, attendance, trainerAttendance, reports, import, familyHome, familyCategories, familyLink, familyTrainings, familyEvents, familyPayments, familyAnnouncements, about, trainers, trainerHome, trainerPlayers, trainerTrainings, trainerEvents, trainerAnnouncements, profile

Coverage added globally for:
- headings, labels and ordinary text
- cards/panels/stats
- tables/rows/cells
- all text/select/textarea controls
- placeholders/options
- dialogs and sticky action bars
- muted/helper text
- links/actions
- buttons and semantic exceptions
- role manager/player linking fields
- native date/time/month controls

The new final-pass rules are scoped to `html[data-theme="dark"]` and every `.view` / `dialog`, so internal modules no longer depend on individual screen-by-screen color patches.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Player profile selector/link logic: PASS.
- Player category synchronization: PASS.
- Dark-mode global coverage: PASS.
- Firestore rules unchanged; existing admin write permissions cover this linking operation.
- Storage rules unchanged.
