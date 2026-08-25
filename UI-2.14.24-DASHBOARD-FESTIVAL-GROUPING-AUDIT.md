# VolleyCore UI 2.14.24 — Dashboard and Festival Grouping

Base: Security 1.0.23 / UI 2.14.23

## Changes

1. Sidebar session identity no longer uses absolute positioning, preventing it from overlaying navigation modules while scrolling.
2. Dashboard now has one upcoming-events module only. The duplicated right-rail "Próximos eventos" card was removed and the main feature card is the single source.
3. Calendar grouping now uses **date + category + actual venue**.
4. Two or more matches sharing date, category and venue are automatically rendered as **FESTIVAL · [CATEGORY]**, regardless of different match times or opponents.
5. Festival detail tokens now include the venue so opening a group cannot pull matches from a different venue on the same date/category.
6. Individual match times and opponents remain visible inside the Festival block.

## Not changed

- Firestore security rules.
- Event creation/edit/delete permissions.
- Training collections or recurrence logic.
- Calendar import persistence model.
- Existing event documents are not migrated or rewritten.
