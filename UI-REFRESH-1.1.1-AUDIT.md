# VolleyCore UI Refresh 1.1.1 — Session Startup Hotfix

Root cause:
- UI Refresh 1.1 removed the old dashboard button with id `newPlayerButton`.
- The JavaScript still executed `$('#newPlayerButton').onclick=...` during module startup.
- That runtime exception happened before Firebase `onAuthStateChanged` could register.
- The 12-second startup watchdog then displayed the session confirmation error.

Fix:
- Removed the stale `newPlayerButton` binding.
- Kept `newPlayerButton2` for the Players module.
- Kept `dashboardNewPlayer` as the new dashboard quick action.
- Audited all simple JavaScript ID selectors against the HTML: PASS.
- JavaScript syntax: PASS.
