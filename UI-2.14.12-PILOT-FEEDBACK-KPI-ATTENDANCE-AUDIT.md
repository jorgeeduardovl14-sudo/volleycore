# VolleyCore UI 2.14.12

## Confirmed corrections

### Bitácora de bajas
The four TOP KPI boxes are now the clickable elements:
- Bajas registradas -> all
- Jugadoras -> player exits
- Personal deportivo -> trainer/assistant exits
- Por insatisfacción -> both sport and administrative dissatisfaction

They render as real buttons and explicitly use a pointer cursor.

### Solicitudes de camisetas
The four TOP KPI boxes are now clickable filters:
- Solicitudes -> all
- Pendientes -> pending
- En proceso -> processing
- Listas para entregar -> ready

They render as real buttons and explicitly use a pointer cursor.

### Asistencia
`Seleccionar todas · Presentes` was rebuilt to:
- require/select a category
- automatically load roster if necessary
- mark every visible roster row present
- dispatch the change event
- hide absence controls
- show a confirmation toast with the number selected

Applied to Admin and Trainer attendance.

## Pilot modules

### User-facing
- Evaluación piloto
- Feature Request / Solicitar mejora

Available to parents/guardians, players, trainers and assistants according to category visibility.

### Admin
New `Piloto y feedback` module:
- survey + feature request visibility controls
- independent enable/disable switches
- all-categories mode (default)
- category-specific visibility
- survey summary and review/classification
- feature-request classification and workflow status

### Survey data
Captures:
- category
- role
- VolleyCore version
- 6 ratings (1–5)
- most useful
- most difficult/confusing
- one change suggestion

Admin classification:
- positive
- UX
- possible bug
- training/use
- other

Review state:
- new
- reviewed
- actioned

### Feature Request data
Captures:
- category
- module
- title
- problem
- proposed behavior
- beneficiary
- perceived urgency
- user role
- version

Admin classification:
- Bug
- UX improvement
- New feature
- Training/use
- Out of scope

Workflow:
New -> Review -> Approved -> Planned -> Implemented / Declined

## Visibility
Default configuration is:
- Survey enabled for ALL categories
- Feature Requests enabled for ALL categories

Admin can later limit either module to selected categories independently.

## Security
New Firestore collections:
- pilotSettings
- pilotFeedback
- featureRequests

Users can create feedback only for enabled pilot categories.
Users can read only their own submissions.
Only Admin can classify/update submissions and change visibility settings.

## Deployment
`firestore.rules` CHANGED and MUST be published.

No changes to:
- ONVO
- payment logic
- Storage rules
- App Check

## Commit
UI 2.14.12 - add pilot feedback modules and fix KPI filters attendance bulk action
