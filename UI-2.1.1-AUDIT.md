# VolleyCore UI 2.1.1 — Assistant Role

## Added
- Separate approved role: `assistant`.
- Separate pending registration role: `pendingAssistant`.
- Public registration option: Asistente de entrenador.
- Admin approval/rejection and category assignment for assistants.
- Assistant account uses the sports staff portal for assigned categories.
- Assistant can access roster, trainings, attendance, events and announcements within assigned categories.
- Contact and financial-state visibility remains controlled by admin permissions.

## Compatibility
- Existing trainer profiles remain unchanged.
- Existing `trainerLevel=assistant` profiles remain readable.
- New assistant users are stored as role=assistant, accountType=assistant, trainerLevel=assistant.

## Validation
- JavaScript syntax: PASS.
- HTML IDs: PASS.
- JS selectors: PASS.
- Firestore pendingAssistant creation rule: PASS.
- Firestore category-scoped staff access: PASS.
