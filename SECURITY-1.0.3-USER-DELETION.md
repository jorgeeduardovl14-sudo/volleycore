# VolleyCore Security 1.0.3 — Secure user deletion

## Admin UI
- `Eliminar usuario` added to User Detail.
- `Eliminar usuario` added to Role Manager.
- Current Administrator cannot delete their own account from VolleyCore.
- A destructive confirmation explains what will be removed and what will be retained.

## Server-side deletion
New Netlify Function: `admin-delete-user.mjs`

The function:
1. Verifies the caller's Firebase ID token.
2. Reads the caller profile and requires role `admin`.
3. Rejects self-deletion.
4. Loads the target user from Firestore.
5. Unlinks target UID from:
   - `players.linkedUserIds`
   - `playerPrivate.linkedUserIds`
   - `families.memberUserIds`
   - `charges.userIds`
6. Deletes `users/{uid}`.
7. Deletes the Firebase Authentication account using the server service account.

## Retained intentionally
- Players are NOT deleted.
- Charges/payment history are NOT deleted.
- SINPE/ONVO historical records are NOT deleted.
- Other financial/audit history is retained.

## Security
- Client Firestore rule for deleting `users` remains DENY.
- User deletion can only occur through the authenticated server function.
- ONVO Functions and secrets remain unchanged.
- App Check integration remains unchanged.

## Deployment
No Firestore or Storage rule publication is required specifically for this change.
Netlify must deploy the new `admin-delete-user` function.
Existing `FIREBASE_SERVICE_ACCOUNT_B64` and `FIREBASE_WEB_API_KEY` environment variables are reused.
