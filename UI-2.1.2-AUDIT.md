# VolleyCore UI 2.1.2 — Session Startup Hotfix

## Root cause
The page had two independent startup watchdogs:
1. A JavaScript auth watchdog.
2. A second inline HTML watchdog that always fired after 12 seconds if the boot screen was still visible.

The HTML watchdog did not know whether Firebase Authentication had already responded and the app was simply resolving the user's Firestore profile. On slower starts it could incorrectly display:
"VolleyCore no pudo completar el inicio..."

## Fixes
- Removed the redundant inline HTML watchdog.
- Extended the controlled JavaScript startup timeout from 12s to 30s.
- Added an explicit `resolving` authentication state once Firebase Auth responds.
- Preserved cached-profile fast startup.
- If the role/status/categories change in Firestore, the refreshed profile now reapplies the correct shell automatically.
- Trainer and Assistant registration/approval logic remains intact.

## Validation
- JavaScript syntax: PASS.
- JS selector-to-HTML audit: PASS.
- Old HTML watchdog removed: PASS.
- Firestore rules unchanged from UI 2.1.1.
