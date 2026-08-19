"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE WEBHOOK
 * ============================================================
 *
 * Netlify Function:
 *
 * /.netlify/functions/paddle/webhook
 *
 * Responsibilities:
 *
 * 1. Accept Paddle webhook
 * 2. Preserve the raw request body
 * 3. Verify Paddle signature
 * 4. Accept only verified events
 * 5. Handle transaction.completed
 * 6. Fulfill the purchase
 * 7. Return a fast successful response
 *
 * IMPORTANT:
 *
 * This function NEVER trusts the frontend to determine:
 *
 * - credits
 * - price
 * - amount
 * - currency
 * - package
 *
 * The verified Paddle price_id is resolved through packages.js.
 *
 * ============================================================
 */

const {
  verifyPaddleWebhook,
} = require("./verify");

const {
  fulfillPaddlePurchase,
} = require("./fulfill");


/* ============================================================
 * NETLIFY RESPONSE HELPER
 * ============================================================
 */

function response(
  statusCode,
  body
) {

  return {
    statusCode,

    headers: {
      "Content-Type": "application/json",
    },

    body:
      typeof body === "string"
        ? body
        : JSON.stringify(body),
  };
}


/* ============================================================
 * METHOD CHECK
 * ============================================================
 */

function methodNotAllowed() {

  return response(
    405,
    {
      success: false,
      error: "Method not allowed.",
    }
  );
}


/* ============================================================
 * WEBHOOK HANDLER
 * ============================================================
 */

exports.handler = async function handler(
  event
) {

  /**
   * Paddle sends webhook notifications using POST.
   */
  if (
    event.httpMethod !== "POST"
  ) {
    return methodNotAllowed();
  }


  /**
   * ----------------------------------------------------------
   * RAW BODY
   * ----------------------------------------------------------
   *
   * Paddle signature verification requires the ORIGINAL
   * request body.
   *
   * Do NOT JSON.parse() before verification.
   *
   * Netlify normally exposes the request body as event.body.
   * If Netlify has base64 encoded it, decode it first.
   * ----------------------------------------------------------
   */

  let rawBody =
    event.body || "";


  if (event.isBase64Encoded) {

    try {

      rawBody =
        Buffer
          .from(
            rawBody,
            "base64"
          )
          .toString("utf8");

    } catch (error) {

      console.error(
        "Failed to decode webhook body:",
        error
      );

      return response(
        400,
        {
          success: false,
          error: "Invalid request body.",
        }
      );
    }
  }


  if (!rawBody) {

    console.error(
      "Paddle webhook received with empty body."
    );

    return response(
      400,
      {
        success: false,
        error: "Empty webhook body.",
      }
    );
  }


  /**
   * ----------------------------------------------------------
   * PADDLE SIGNATURE
   * ----------------------------------------------------------
   *
   * Header names can be normalized by the platform, so check
   * both common representations.
   * ----------------------------------------------------------
   */

  const headers =
    event.headers || {};


  const signature =
    headers["paddle-signature"] ||
    headers["Paddle-Signature"] ||
    "";


  if (!signature) {

    console.error(
      "Paddle webhook missing Paddle-Signature header."
    );

    return response(
      400,
      {
        success: false,
        error: "Missing Paddle-Signature.",
      }
    );
  }


  /* ==========================================================
   * VERIFY PADDLE WEBHOOK
   * ==========================================================
   *
   * This MUST happen before any database operation.
   * ==========================================================
   */

  let webhookEvent;

  try {

    webhookEvent =
      await verifyPaddleWebhook({
        rawBody,
        signature,
      });

  } catch (error) {

    console.error(
      "Paddle webhook signature verification failed:",
      error
    );

    /**
     * Do not reveal verification details to the caller.
     */
    return response(
      400,
      {
        success: false,
        error: "Invalid Paddle webhook.",
      }
    );
  }


  /* ==========================================================
   * VERIFIED EVENT
   * ==========================================================
   */

  const eventType =
    webhookEvent?.eventType;


  const eventId =
    webhookEvent?.eventId;


  console.log(
    "Verified Paddle webhook:",
    {
      eventType,
      eventId,
    }
  );


  /* ==========================================================
   * EVENT ROUTING
   * ==========================================================
   */

  switch (eventType) {

    /**
     * --------------------------------------------------------
     * SUCCESSFUL PAYMENT
     * --------------------------------------------------------
     *
     * Paddle's transaction.completed event means the
     * transaction has completed successfully.
     *
     * This is where Precifio provisions credits.
     * --------------------------------------------------------
     */

    case "transaction.completed": {

      const transaction =
        webhookEvent?.data;


      if (!transaction) {

        console.error(
          "transaction.completed contained no transaction data."
        );

        return response(
          400,
          {
            success: false,
            error: "Missing transaction data.",
          }
        );
      }


      try {

        const result =
          await fulfillPaddlePurchase(
            transaction
          );


        console.log(
          "Paddle purchase fulfilled:",
          {
            transactionId:
              result.transactionId,

            userId:
              result.userId,

            packageId:
              result.packageId,

            credits:
              result.credits,

            alreadyFulfilled:
              result.alreadyFulfilled,

            balanceAfter:
              result.balanceAfter,
          }
        );


        /**
         * 200 tells Paddle that the notification was
         * successfully handled.
         *
         * If the purchase was already fulfilled, we STILL
         * return success. That is expected idempotent behavior.
         */
        return response(
          200,
          {
            success: true,

            event:
              eventType,

            eventId,

            transactionId:
              result.transactionId,

            alreadyFulfilled:
              result.alreadyFulfilled,
          }
        );

      } catch (error) {

        /**
         * IMPORTANT:
         *
         * Return a non-2xx response when fulfillment fails.
         *
         * This allows Paddle to retry delivery.
         */
        console.error(
          "Paddle purchase fulfillment failed:",
          error
        );


        return response(
          500,
          {
            success: false,
            error:
              "Purchase fulfillment failed.",
          }
        );
      }
    }


    /* ========================================================
     * OTHER EVENTS
     * ========================================================
     *
     * We don't need them yet.
     *
     * They are acknowledged so Paddle doesn't repeatedly retry
     * events that Precifio intentionally doesn't process.
     * ========================================================
     */

    default: {

      console.log(
        "Paddle event acknowledged but not handled:",
        eventType
      );


      return response(
        200,
        {
          success: true,

          handled: false,

          event:
            eventType,

          eventId,
        }
      );
    }
  }
};