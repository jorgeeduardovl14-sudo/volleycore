# VolleyCore UI 2.14.8 — Offboarding + Full Dark Mode Audit

## Bitácora de bajas
Administración > Bitácora de bajas.

Changing an active Player, User, Trainer or Assistant to Inactive now requires an offboarding form. It records effective date, temporary/definitive status, structured reason, destination team when applicable, dissatisfaction area when applicable, context, notes, and processor identity.

Records are stored in `exitRecords` and are append-only.

## Full dark-mode audit
Final contrast rules were reviewed and hardened across Dashboard, Jugadoras, Categorías, Entrenadores, Asistencia, Entrenamientos, Eventos, Temporadas, Gimnasios, Pagos, Mensualidades, Reportes, Familias, Administración de usuarios, Vinculaciones, Camisetas, Comunicados, Importación, Perfil and dialogs/modals.

Explicit dark-mode foreground/background pairs now exist for all primary badge states so legacy inherited colors cannot make status text unreadable.

## Deployment
Firestore Rules changed for `exitRecords` and must be published.
Storage Rules, ONVO Functions, App Check and payment logic are unchanged.

## Commit
UI 2.14.8 - add offboarding log and complete dark mode audit
