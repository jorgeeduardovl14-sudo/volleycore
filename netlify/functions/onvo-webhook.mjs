import {
  json,
  safeOrigin,
  verifyFirebaseUser,
  getDocument,
  commitWrites,
  updateWrite,
  transformServerTimestampWrite
} from "./_firebase-rest.mjs";

const ONVO_ENDPOINT =
  "https://api.onvopay.com/v1/checkout/sessions/one-time-link";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204
    });
  }

  if (request.method !== "POST") {
    return json(405, {
      error: "Method not allowed"
    });
  }

  try {
    const secretKey =
      process.env.ONVO_SECRET_KEY;

    if (!secretKey) {
      return json(503, {
        error:
          "ONVO sandbox is not configured yet."
      });
    }

    if (
      !secretKey.startsWith(
        "onvo_test_"
      ) &&
      process.env.ONVO_ALLOW_LIVE !==
        "true"
    ) {
      return json(503, {
        error:
          "Live ONVO keys are blocked in this test integration."
      });
    }

    const decoded =
      await verifyFirebaseUser(request);

    const body =
      await request.json();

    const chargeId =
      String(
        body.chargeId || ""
      ).trim();

    if (!chargeId) {
      return json(400, {
        error:
          "chargeId is required."
      });
    }

    const [charge, user] =
      await Promise.all([
        getDocument(
          "charges",
          chargeId
        ),

        getDocument(
          "users",
          decoded.uid
        )
      ]);

    if (!charge) {
      return json(404, {
        error:
          "Charge not found."
      });
    }

    const isAdmin =
      [
        "admin",
        "treasurer"
      ].includes(
        user?.role
      );

    const allowed =
      isAdmin ||
      (
        Array.isArray(
          charge.userIds
        ) &&
        charge.userIds.includes(
          decoded.uid
        )
      );

    if (!allowed) {
      return json(403, {
        error:
          "You do not have access to this charge."
      });
    }

    const total =
      Number(
        charge.amount || 0
      );

    const paid =
      Number(
        charge.paidAmount || 0
      );

    const remainingCRC =
      Math.max(
        0,
        total - paid
      );

    if (!remainingCRC) {
      return json(409, {
        error:
          "This charge is already paid."
      });
    }

    const unitAmount =
      Math.round(
        remainingCRC * 100
      );

    const origin =
      safeOrigin(
        request,
        body.returnBaseUrl
      );

    const successUrl =
      `${origin}/?onvo=success&charge=${encodeURIComponent(
        chargeId
      )}`;

    const cancelUrl =
      `${origin}/?onvo=cancel&charge=${encodeURIComponent(
        chargeId
      )}`;

    const payload = {
      lineItems: [
        {
          quantity: 1,
          unitAmount,
          currency: "CRC",

          description:
            `VolleyCore ${
              charge.month || ""
            } · ${
              charge.playerCode ||
              charge.playerId ||
              ""
            }`.trim()
        }
      ],

      customerEmail:
        decoded.email ||
        user?.email ||
        undefined,

      redirectUrl:
        successUrl,

      cancelUrl,

      metadata: {
        orgId:
          charge.orgId ||
          "asbavol",

        chargeId,

        playerId:
          charge.playerId ||
          "",

        userId:
          decoded.uid,

        month:
          charge.month ||
          "",

        source:
          "volleycore"
      }
    };

    const onvoRes =
      await fetch(
        ONVO_ENDPOINT,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${secretKey}`,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );

    const onvo =
      await onvoRes
        .json()
        .catch(
          () => ({})
        );

    if (!onvoRes.ok) {
      console.error(
        "ONVO checkout error",
        onvoRes.status,
        onvo
      );

      return json(502, {
        error:
          onvo.message ||
          onvo.error?.message ||
          `ONVO rejected checkout (${onvoRes.status}).`
      });
    }

    const sessionId =
      onvo.id ||
      onvo.checkoutSessionId ||
      "";

    if (!onvo.url) {
      return json(502, {
        error:
          "ONVO did not return a checkout URL."
      });
    }

    const writes = [];

    if (sessionId) {
      writes.push(
        updateWrite(
          "onvoCheckoutSessions",
          sessionId,
          {
            orgId:
              charge.orgId ||
              "asbavol",

            chargeId,

            playerId:
              charge.playerId ||
              "",

            userId:
              decoded.uid,

            month:
              charge.month ||
              "",

            amount:
              remainingCRC,

            amountMinor:
              unitAmount,

            currency:
              "CRC",

            mode:
              secretKey.startsWith(
                "onvo_test_"
              )
                ? "test"
                : "live",

            status:
              "checkout_created",

            url:
              onvo.url
          },

          null,

          {
            exists: false
          }
        )
      );

      writes.push(
        transformServerTimestampWrite(
          "onvoCheckoutSessions",
          sessionId,
          "createdAt"
        )
      );
    }

    writes.push(
      updateWrite(
        "charges",
        chargeId,
        {
          onvoPaymentStatus:
            "checkout_created",

          onvoLastCheckoutSessionId:
            sessionId ||
            null
        },

        [
          "onvoPaymentStatus",
          "onvoLastCheckoutSessionId"
        ]
      )
    );

    writes.push(
      transformServerTimestampWrite(
        "charges",
        chargeId,
        "updatedAt"
      )
    );

    await commitWrites(
      writes
    );

    return json(200, {
      url:
        onvo.url,

      sessionId,

      mode:
        secretKey.startsWith(
          "onvo_test_"
        )
          ? "test"
          : "live"
    });
  }

  catch (error) {
    console.error(
      error
    );

    return json(500, {
      error:
        error.message ||
        "Unexpected server error."
    });
  }
};
