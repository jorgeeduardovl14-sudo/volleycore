# VolleyCore UI 2.9.2 — Universal Mobile Add-to-Calendar

## Goal
Make the existing "Agregar al calendario" action behave appropriately from mobile browsers instead of only downloading an ICS file.

## Behavior
- Android: opens Google Calendar with event title, date/time, location and description prefilled.
- iPhone/iPad: opens a calendar-compatible ICS resource for the device calendar flow.
- Desktop/other platforms: shows a compact chooser between Google Calendar and the device/ICS calendar.
- The category-wide calendar remains an ICS import because it can contain multiple events.

## Event details carried to calendar
- Category + event title
- Date and start/end time
- Opponent
- Home / visitor
- Uniform
- Venue / away venue / address
- Waze/Maps URL
- Notes

## Validation
- JavaScript syntax: PASS.
- HTML duplicate IDs: PASS.
- JS selector-to-HTML audit: PASS.
- Platform detection: PASS.
- Google Calendar event URL flow: PASS.
- Native ICS flow: PASS.
- Firestore and Storage rules unchanged.
