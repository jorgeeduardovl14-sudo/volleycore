# UI 2.14.29 — Payment, Festival, Jersey & Dark Mode Stabilization

Base: Security 1.0.23 / UI 2.14.28

Implemented:
- Payment reporting confirmation and return to Family payments view.
- Admin payment registry tabs: Pending, Approved, Rejected, History.
- Bulk payment inbox family resolution improved.
- Family event festival grouping uses shared sports grouping logic.
- Category jersey availability uses a category-level occupied-number snapshot so Family and Admin see the same truth without exposing private roster data. Admin refresh synchronizes the snapshot.
- Finance tabs moved above filters.
- Full dark-mode regression CSS guard across views, forms, tables, tabs and secondary actions.

Parking lot unchanged: mandatory email verification and MFA/TOTP.
