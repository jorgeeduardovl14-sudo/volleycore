# VolleyCore Security 1.0.8 / UI 2.14.8

## 1. Offboarding & Retention Log
A structured administrative offboarding workflow is now required when an existing:
- player is changed to Inactive
- user is changed to Inactive
- trainer/assistant is changed to Inactive

The form captures:
- exit date
- temporary or definitive exit
- primary reason
- destination club/team when transferring
- dissatisfaction area when applicable
- possibility of return
- reason detail
- administrative notes
- processing administrator

Records are stored separately in `exitRecords`, so historical records survive reactivation.

New module:
Administration > Bitácora de bajas

Filters:
- search
- entity type
- reason
- category
- month

## 2. Dark mode full-module static QA
Reviewed application views found in index.html (35 total):
- dashboard
- trainerPending
- players
- categories
- seasons
- trainings
- events
- venues
- announcements
- finances
- sinpeAdmin
- users
- linkAdmin
- userAdmin
- exitLog
- shirtAdmin
- attendance
- trainerAttendance
- reports
- import
- familyHome
- familyCategories
- familyLink
- familyTrainings
- familyEvents
- familyPayments
- familyAnnouncements
- about
- trainers
- trainerHome
- trainerPlayers
- trainerTrainings
- trainerEvents
- trainerAnnouncements
- profile

The final dark-mode layer now explicitly covers:
- titles and normal text
- muted/secondary text
- cards and panels
- tables
- filters and form controls
- dialogs/modals
- buttons and action controls
- notices
- dynamic JavaScript cards
- semantic status badges
- monthly fee states
- national-team badge
- dashboard semantic icons

The issue previously visible in Mensualidades (light badge with nearly invisible text)
has a dedicated final override after all generic dark-mode rules.

## 3. Security
New Firestore collection: `exitRecords`
- read: Admin only
- create: Admin only, processedBy must be current UID
- update: Admin only; entity identity and original processor cannot be changed
- delete: denied

## Deployment
`firestore.rules` changed and MUST be published for the offboarding log to work.
Storage rules, App Check and ONVO functions are unchanged.

## Commit
UI 2.14.8 - add offboarding log and complete dark mode contrast audit
