# UI 2.14.31 — Family Payment Button Hotfix

Base: Security 1.0.23 / UI 2.14.30

Fixed:
- `Reportar pago` failed before opening the dialog because `latestKnownMonthForPlayer()` was referenced but undefined.
- Added `latestKnownMonthForPlayer()` to determine the most recent known billing month for a linked player.
- Added `addMonths()` because the advance-payment flow also referenced it without a definition.
- No other payment logic, UI, permissions, festival logic, security settings, or data model was changed.

Parking lot remains unchanged:
- Mandatory email verification.
- MFA / TOTP.
