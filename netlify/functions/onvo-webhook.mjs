import { getAdmin, json } from "./_firebase-admin.mjs";

function normalizePaidAmount(data) {
  const minor = Number(data.amountTotal ?? data.receivedAmount ?? data.amount ?? 0);
  return Math.round(minor) / 100;
}

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const expected = process.env.ONVO_WEBHOOK_SECRET;
    if (!expected) return json(503, { error: "Webhook secret is not configured." });

    const received = request.headers.get("x-webhook-secret") || "";
    if (received !== expected) return json(401, { error: "Invalid webhook secret." });

    const event = await request.json();
    const type = String(event.type || "");
    const data = event.data || {};
    const metadata = data.metadata || {};
    const chargeId = metadata.chargeId || "";
    const eventObjectId = data.id || "unknown";
    const eventId = `${type}:${eventObjectId}`.replace(/[^a-zA-Z0-9_.:-]/g, "_");

    const { db, FieldValue } = getAdmin();
    const eventRef = db.collection("onvoWebhookEvents").doc(eventId);

    const result = await db.runTransaction(async tx => {
      const existing = await tx.get(eventRef);
      if (existing.exists) return { duplicate: true };

      tx.set(eventRef, {
        type,
        objectId: eventObjectId,
        chargeId: chargeId || null,
        receivedAt: FieldValue.serverTimestamp(),
        processed: false,
      });

      if (!chargeId) {
        tx.update(eventRef, { processed: true, note: "No VolleyCore chargeId in metadata." });
        return { ignored: true };
      }

      const chargeRef = db.collection("charges").doc(chargeId);
      const chargeSnap = await tx.get(chargeRef);
      if (!chargeSnap.exists) {
        tx.update(eventRef, { processed: true, note: "Charge not found." });
        return { ignored: true };
      }
      const charge = chargeSnap.data();

      if (type === "checkout-session.succeeded" && data.paymentStatus === "paid") {
        const paidCRC = normalizePaidAmount(data);
        const chargeAmount = Number(charge.amount || 0);
        const previousPaid = Number(charge.paidAmount || 0);
        const newPaid = Math.min(chargeAmount, previousPaid + paidCRC);
        const status = newPaid >= chargeAmount ? "paid" : "partial";

        tx.set(db.collection("onvoPayments").doc(data.id), {
          orgId: charge.orgId || metadata.orgId || "asbavol",
          chargeId,
          playerId: charge.playerId || metadata.playerId || "",
          userId: metadata.userId || "",
          month: charge.month || metadata.month || "",
          amount: paidCRC,
          currency: data.currency || "CRC",
          status: "paid",
          mode: data.mode || "test",
          checkoutSessionId: data.id,
          paymentIntentId: data.paymentIntentId || "",
          customerId: data.customerId || "",
          customerEmail: data.customer?.email || "",
          rawPaymentStatus: data.paymentStatus || "",
          paidAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.set(chargeRef, {
          paidAmount: newPaid,
          status,
          onvoPaymentStatus: "paid",
          onvoLastCheckoutSessionId: data.id,
          onvoLastPaymentIntentId: data.paymentIntentId || null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        tx.update(eventRef, { processed: true, result: status });
        return { paid: true, status };
      }

      // Keep other payment states visible without marking the charge paid.
      if (type === "payment-intent.deferred") {
        tx.set(chargeRef, { onvoPaymentStatus: "processing", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      if (type === "payment-intent.failed") {
        tx.set(chargeRef, { onvoPaymentStatus: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      tx.update(eventRef, { processed: true, note: `Observed ${type}` });
      return { observed: true };
    });

    return json(200, { received: true, ...result });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || "Webhook processing failed." });
  }
};
