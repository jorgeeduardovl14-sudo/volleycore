# UI 2.14.28 — Family Bulk Payments & Finance UX

Base: Security 1.0.23 / UI 2.14.27

Implemented:
- Bulk family manual payments: one report can cover multiple players and multiple months.
- Advance/prepaid months per player (up to 24 per report), including months whose charge does not exist yet; Finance creates/applies those charges on approval.
- One receipt image can be attached to a manual payment and reviewed by Finance/Admin.
- Payment report stores individual allocations for player/category/month accounting and optional credit balance when the deposited amount exceeds the selected total.
- Finance filters now require explicit “Aplicar filtros”, include “Limpiar filtros”, and show the exact active period/category.
- Finance month selectors use Spanish month labels instead of browser-native English month input rendering.
- Dark-mode contrast fixed for Finance tabs with explicit active/inactive/hover states and regression-safe styling.
- Bank reconciliation continues to match the total payment transaction, while income-by-category uses the allocation detail.

Parking lot — NOT implemented:
- Mandatory email verification.
- MFA / TOTP.
