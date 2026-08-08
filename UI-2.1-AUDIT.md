# VolleyCore UI 2.1 — Trainer Registration & Approval

- Public registration now includes Entrenador/a.
- New trainer accounts are created as pendingTrainer / pending.
- Pending trainers see a dedicated approval-status screen, not family modules.
- Admin Trainers module displays pending applications.
- Admin can review, assign one or more categories, set trainer level and permissions, and approve.
- Approval promotes the same user account to role=trainer and status=active.
- Admin may reject an application.
- Existing trainer scoped access and attendance behavior is preserved.
- Firestore rules explicitly allow secure self-creation of pending trainer requests.
- JavaScript syntax: PASS.
- HTML ID/selector audit: PASS.
