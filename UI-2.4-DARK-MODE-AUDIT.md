# VolleyCore UI 2.4 — Full Dark Mode Audit

## Scope reviewed before build
The complete UI shell was audited, including every static application view and every dialog in `index.html`, plus dynamic component classes rendered from `app-ui-2.4.js`.

### 31 application views reviewed
- Dashboard
- Trainer pending approval
- Players
- Categories
- Seasons
- Trainings
- Events
- Venues
- Announcements
- Monthly finances
- Payments / SINPE
- Families / users
- Attendance
- Trainer attendance
- Reports
- Import
- Family home
- Family categories
- Family linking
- Family trainings
- Family events
- Family payments
- Family announcements
- About
- Trainers / permissions
- Trainer home
- Trainer players
- Trainer trainings
- Trainer events
- Trainer announcements
- Profile

### 23 dialogs reviewed
- Player detail
- Player financial detail
- Family editor
- Family detail
- Family member picker
- User detail
- Trainer / permissions editor
- Player editor
- Category detail
- Category video
- Category editor
- Venue editor
- Event editor
- Event detail
- Season editor
- Training editor
- Training exception
- Future training change
- Announcement editor
- Charge editor
- Generate monthly charges
- Payment approval
- Confirmation

## Root cause identified
Dark mode had been patched in `ui-refresh.css`, but legacy light-theme rules also exist in `styles.css` and in seven inline `<style>` blocks inside `index.html`. Several of those rules still explicitly set white / near-white surfaces and light-theme text colors. Dynamic components rendered by JavaScript also use classes that were not all covered by the previous dark-mode patch.

## Corrections
- Added a final, application-wide stylesheet: `dark-mode-final.css`.
- It is loaded after all legacy inline CSS so it wins the cascade consistently.
- Legacy design tokens (`--bg`, `--card`, `--line`, `--text`, `--muted`) are remapped in dark mode.
- Global dark typography rules cover every module workspace and every dialog.
- Form fields, selects, textareas, tables, secondary buttons, action buttons, checklists, multi-selects, month selectors, attendance rows, player/category editors and trainer-permission controls now use dark surfaces and light text.
- Dynamic JS-rendered components are explicitly covered: player cards, family cards, event cards, chips, mini-lists, picker items, payment metadata and profile sections.
- Status badges keep semantic colors with dark-compatible contrast.
- The approved white branded top header intentionally remains white.
- Authentication screens remain legible if dark preference is stored after sign-out.

## Static validation
- 31/31 application views included in audit.
- 23/23 dialogs included in audit.
- 35 classes with legacy light-background or dark-text declarations were detected and checked.
- 0 uncovered legacy light/dark classes after the final stylesheet audit.
- JavaScript syntax (`node --check`): PASS.
- No business logic or Firestore rules changed.
