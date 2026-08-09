# VolleyCore UI 2.11 — Player Identity + Notifications + Mobile Logout + Dark Mode

## Player identity
- Player accounts load their own player document directly from `users/{uid}.playerId`.
- They no longer depend on a pre-existing `linkedUserIds` query.
- Legacy missing self-link is repaired once.
- If `playerId` is missing, exactly one legacy linked player can still be used as fallback.
- If no valid identity exists, the player sees a clear "Perfil de jugadora incompleto" message.

## Categories / events / notifications
- Category access comes from the actual player record: primary + categoryIds + reinforcementCategoryIds.
- Player notification filtering uses the resolved player profile directly.
- Realtime player profile + events listeners refresh Inicio, Mis categorías, Eventos and the bell.
- Family logic remains separate.

## Admin verification
- Administration de usuarios shows a visible player-link status.
- Valid: ✓ player name + primary category + reinforcement categories.
- Invalid: ⚠ Sin ficha de jugadora vinculada.

## Mobile logout
- Added Cerrar sesión to every role navigation on screens <= 920px.
- Desktop logout remains unchanged.

## Dark mode
- Explicit module-by-module audit covers 32 views and 25 dialogs.
- Text, muted copy, cards, tables, forms, placeholders, selects/options, buttons, links and dialog surfaces are overridden in dark mode.

## Firestore rules
- Player may read own player document when `users/{uid}.playerId == playerId`.
- Added narrowly-scoped one-time self-link repair for own UID only.
- Firestore rules changed and must be republished.

## Validation
- JavaScript syntax: PASS
- HTML duplicate IDs: PASS
- JS selector audit: PASS
- Direct playerId loading: PASS
- Player realtime: PASS
- Notification category resolution: PASS
- Admin link diagnostics: PASS
- Mobile logout: PASS
- Dark mode: 32/32 views, 25/25 dialogs
