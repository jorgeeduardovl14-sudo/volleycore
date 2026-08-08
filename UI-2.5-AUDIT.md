# VolleyCore UI 2.5 — Coach/Assistant Event Creation

## Scope
- Trainer and Assistant can create events.
- They can only choose categories assigned to their profile.
- They can edit events only when both the existing event and the updated event remain inside their assigned categories.
- Admin/Treasurer retain full event management.
- Event deletion remains disabled.

## Event fields
- Type.
- Title.
- Opponent.
- Date/time.
- Home/Away.
- Venue.
- Waze/Maps location URL.
- Uniform: Rojo, Negro, Blanco, Celeste/Fucsia, or Por definir.
- Status.
- Notes.

## Visibility
- New events use the existing shared event model.
- They are immediately visible to admin and assigned coaching staff.
- Existing family/player event-read model remains compatible for future player-profile work.

## Security
- Firestore rules now enforce assigned-category checks on coach/assistant event create/update.
- A coach cannot bypass the UI and write an event to another category.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Uniform field: PASS.
- Trainer event-create button: PASS.
- Firestore category restriction: PASS.
