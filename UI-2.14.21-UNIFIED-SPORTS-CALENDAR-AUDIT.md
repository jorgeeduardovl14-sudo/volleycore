# VolleyCore UI 2.14.21 — Calendario Deportivo

## Unified experience
- Admin navigation consolidates Entrenamientos + Eventos into one visible module: Calendario Deportivo.
- Underlying Firestore collections remain separate for safety.
- + Crear offers Entrenamiento / Partido / Festival / Otro evento.

## Categories
- New events and training series require at least one category.
- Multiple categories can be selected.
- New records store both:
  - categoryId (primary, backwards compatibility)
  - categoryIds (all selected categories)
- Filters and calendar rendering support both old and new records.

## Calendar cards
- Training cards explicitly say ENTRENAMIENTO.
- Event groups explicitly say PARTIDO / X PARTIDOS / FESTIVAL / EVENTO.
- Same date + same category set is one calendar card.
- Internal matches are not independently clickable from calendar.
- Clicking the card opens one Jornada detail.
- Individual event editing is available from the Jornada detail.

## Calendar behavior
- Week / Month / List retained.
- Filters: Category / Venue / Activity Type / Season.
- Existing match-over-training suppression retained and extended to multicategory activities.
- Fixed category colors retained.

## Downloads
- Full sports calendar ICS includes upcoming events and generated training occurrences.
- Category ICS includes upcoming events + training occurrences.
- Compatible with Apple Calendar / Google Calendar / Outlook import.

## Scope
No Firestore rule changes.
No ONVO/payment/App Check/Storage changes.

## Commit
UI 2.14.21 - unify trainings and events into sports calendar

Additional validation:
- Training occurrence click offers Solo este día / Este y los siguientes / Toda la serie.
- List view includes grouped upcoming event dates plus recurring training series.
- Category detail has separate Import and Download calendar actions.
