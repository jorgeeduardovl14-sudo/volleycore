# VolleyCore UI 2.13 — Shirt Requests + Player Profile Fields

## Shirt requests
- Global "Solicitud de camiseta" button added to the home screen for Admin, Family/Player, Trainer/Assistant and pending sports staff.
- Products limited to:
  - Camisa de aficionado
  - Uniforme de Iniciación
- Request captures size, quantity, player name when applicable, and notes.
- Requester sees "Mis solicitudes" with current status.
- Statuses: Pendiente, En proceso, Lista para entregar, Entregada, Cancelada.
- New request generates an admin-only notification.
- Admin status change generates a notification only for the original requester.
- Admin has dedicated "Solicitudes de camisetas" view with filters and status management.
- `shirtRequests` Firestore rules allow users to create/read only their own requests; only Admin can update.

## Player profile
- Removed the Mayor/Menor de edad selector and display.
- Added "Seleccionada Nacional" checkbox.
- Added 🇨🇷 Selección Nacional badge in player detail.
- Added Número de cédula / identificación field.
- Identification is shown only in the administrative player detail (`adminAllowed`), not on public/category cards.

## Protected functionality
- ONVO/Netlify server functions are unchanged from UI 2.12.2.
- Existing calendar, notifications, roles and player identity flow were not restructured.

## Deployment
- Firestore rules changed and must be republished.
- Storage rules unchanged.

## Validation
- Frontend JavaScript syntax: PASS
- HTML duplicate IDs: PASS
- JS selector-to-HTML audit: PASS
- No playerType UI selector/reference: PASS
- Shirt request notification routing: PASS
- Player national-team + identification fields: PASS
