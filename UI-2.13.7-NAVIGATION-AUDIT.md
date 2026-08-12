# VolleyCore UI 2.13.7 — Refresh persistence and live monthly updates

Implemented:
- Current module is preserved in session storage and URL hash.
- Browser refresh returns the user to the same authorized module instead of Inicio.
- Back/forward navigation through module hashes is supported.
- Stored views are validated against the authenticated role before restoration.
- Fixed the charges realtime listener calling a nonexistent `renderFinances()` function.
- Monthly fee edits refresh the current module immediately after save.
- SINPE payment approval refreshes the current payment/monthly module immediately after confirmation.
- Existing App Check, ONVO, Firestore rules, Storage rules, branding, and logo remain unchanged.
