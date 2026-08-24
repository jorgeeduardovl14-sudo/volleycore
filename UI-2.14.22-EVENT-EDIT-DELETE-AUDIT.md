# VolleyCore UI 2.14.22 — Event Edit/Delete

## Event management
- Existing sports events can be edited from the Jornada detail.
- Each match/event in a grouped Jornada has Edit and Delete actions.
- The event editor itself exposes Delete for existing events.
- The standard event detail exposes Delete alongside Edit.
- Delete confirmation identifies whether the record is a Partido, Festival or Evento and shows date/time/rival.
- After deletion the unified Calendario Deportivo reloads immediately so deleted matches do not remain visually cached.

## Permissions
- Admin and Treasurer retain event management.
- Coaches can manage only events whose categories are all within their assigned categories.
- Delete uses the same management permission check as Edit.

## Multicategory compatibility
- Event detail shows all categories.
- Legacy Events filtering and category detail lists now recognize categoryIds as well as legacy categoryId.

## Scope
- No Firestore Rules changes.
- No changes to ONVO/payments, Super Admin, App Check or Storage.
- Training-series deletion was not added in this release; this release is specifically for events/parties/festivals.

## Commit
UI 2.14.22 - add event editing and deletion across sports calendar
