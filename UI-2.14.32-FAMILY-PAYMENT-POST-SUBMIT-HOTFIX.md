# UI 2.14.32 — Family Payment Post-Submit Hotfix

Base: Security 1.0.23 / UI 2.14.31

Root cause:
- The payment report was successfully written to Firestore.
- Immediately afterward, the UI called `showView('familyPayments')`.
- VolleyCore navigation uses `go(view)`, and `showView` does not exist.
- This produced `Can't find variable: showView`, preventing the success confirmation from rendering.

Fix:
- Replaced the invalid `showView('familyPayments')` call with `go('familyPayments')`.
- No payment calculation, approval logic, Firebase rules, festival grouping, or security behavior changed.

Important:
- Reports submitted while UI 2.14.31 showed this error may already exist in Firestore because the failure happened after `addDoc()`.
