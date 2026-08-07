# VolleyCore UI 2.0 — Approved Layout

## Goal
Rebuild the visual shell so the real app follows the approved dashboard mockup rather than layering patches over the prior layout.

## Structural changes
- Black sidebar now starts at the top of the viewport and extends full height.
- White header begins exactly after the sidebar, rather than covering it.
- Santa Bárbara header branding and sidebar branding are fully visible.
- Header proportions, brand lockup, KPI cards, feature cards, right rail and footer were aligned to the approved visual.
- Added clear sidebar user strip and top user identity.
- Dashboard remains powered by the existing real VolleyCore data.

## Logic preserved
- Authentication/session.
- Firebase/Firestore.
- Categories.
- Players.
- Families.
- Payments.
- Attendance.
- Events.
- Trainers.
- Reports.
- Existing Firestore rules.

## Validation
- JavaScript syntax: PASS.
- Duplicate HTML IDs: PASS.
- All simple JavaScript ID selectors resolve to existing HTML elements: PASS.
