# VolleyCore Sprint 1.1 — Familias

Cambio incremental sobre v3.7.3-stable.

## Alcance
- Crear y editar grupos familiares.
- Asociar varios usuarios y varias jugadoras a una familia.
- Sincronizar `familyId`, `linkedUserIds` y mensualidades.
- Vista individual de familia con saldo, usuarios y jugadoras.
- Métricas de familias, usuarios/jugadoras sin asignar y saldo familiar.

## Seguridad
No modifica Firebase Authentication ni el flujo de arranque. No requiere cambios en `firestore.rules`.
