# UI 2.14.30 — Family Payment Workflow & Festival Stabilization

Base: Security 1.0.23 / UI 2.14.29

Implemented:
- Redesigned Family payment report with one payment-type dropdown: pending dues or advance payments.
- Time is filled automatically.
- Pending mode supports multi-player/multi-charge selection and automatic total.
- Advance mode accepts advance amount per linked player, maps full future monthly dues, and records remaining credit.
- Receipt rule: receipt number OR receipt photo is required; either one satisfies evidence requirement.
- Clear success state after submission and persistent Family report status cards (Pending / Approved / Rejected).
- Admin continues to receive one transaction with allocation details and receipt evidence.
- Family pending charges disappear after Admin approval because approval updates/creates the covered charges.
- Family Home and Family Events now share the same festival grouping key as the sports calendar: category set + date + venue.
- Family event derivation supports multi-category events.
- Storage rule for payment receipts allows same-org authenticated users to create only inside their own UID path; Admin/Treasurer and the owner can read.

Important deployment note:
The Storage Rules change must be deployed to Firebase Storage. Updating Netlify/GitHub files alone does not change the live Firebase Storage rules.

Parking lot unchanged: mandatory email verification and MFA/TOTP.
