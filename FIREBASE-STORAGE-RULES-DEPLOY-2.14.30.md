# Firebase Storage Rules deployment — UI 2.14.30

The payment receipt fix requires the included `storage.rules` to be deployed in Firebase.

For Firebase Console (web):
1. Open Firebase Console for the VolleyCore project.
2. Go to Storage > Rules.
3. Replace the current rules with the contents of this version's `storage.rules`.
4. Click Publish.
5. Retest from a Family account by uploading a receipt image.

Expected path: `orgs/asbavol/paymentReceipts/{userUid}/{fileName}`.
The owner may upload/read their own receipt; Admin/Treasurer may read it; other families may not read it.
