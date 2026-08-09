# VolleyCore UI 2.8 — Calendar Trial + Two Fixes

## 1. Dashboard visitor venue fix
- Dashboard next match now uses the real event location helper.
- Upcoming events no longer rely only on venueId.
- Shared event mini-cards and family event cards also show visitor venue/address correctly.

## 2. Category save UX
- After a successful category save, the edit dialog closes automatically.
- A confirmation toast says: "Categoría guardada correctamente."
- The editor is no longer reopened after saving.

## 3. Calendar trial
- Category detail includes "Agregar calendario".
- Generates a standard .ics file with upcoming non-cancelled events for that category.
- Works with Google Calendar, Apple Calendar, Outlook and other ICS-compatible calendars.
- Event detail includes "Agregar al calendario" for a single event.
- Family event cards also include an individual calendar button.
- Calendar entries include date/time, category, opponent, home/visitor, uniform, venue/address, Waze/Maps URL and notes when available.
- This release is a downloadable/importable calendar trial, not yet a live auto-updating subscription URL.

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Dashboard visitor location: PASS.
- Category dialog close-after-save: PASS.
- Category/event ICS generation: PASS.
- Firestore and Storage rules unchanged from UI 2.7.
