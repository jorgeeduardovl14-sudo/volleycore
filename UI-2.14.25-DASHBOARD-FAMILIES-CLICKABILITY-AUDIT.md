# VolleyCore UI 2.14.25 — Dashboard Festival Summary & Family Card Clickability

Base: Security 1.0.23 / UI 2.14.24

## Scope

This release contains only the two approved corrective changes.

### 1. Dashboard — Próximos eventos
- Upcoming sports events now use the same grouping key as the sports calendar: category set + date + actual venue.
- Two or more matches in the same category, on the same date, at the same venue are displayed as one `FESTIVAL · [CATEGORÍA]` entry.
- The festival entry shows the actual venue once and summarizes each match below with its own time and opponent.
- The dashboard limit is applied to grouped upcoming events, not individual matches, preventing one festival from consuming multiple event slots.
- Single matches and other events keep their prior compact presentation.

### 2. Familias — full-card click target
- Each family panel is now a clickable card using the existing `data-view-family` navigation behavior.
- Clicking the body/background of a family card opens that family's detail.
- Existing nested actions (player, user, manage members, edit family, etc.) keep their own behavior because the delegated click handler resolves the nearest actionable element first.
- No visual redesign and no permission changes were introduced.

## Not changed
- Firestore rules / Security version.
- Event create/edit/delete behavior.
- Calendar grouping logic.
- Training logic.
- Family permissions or data model.
