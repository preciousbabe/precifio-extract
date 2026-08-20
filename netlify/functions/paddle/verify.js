"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE WEBHOOK VERIFICATION
 * ============================================================
 * netlify/functions/paddle/verify.js
 * This module verifies that a webhook genuinely came from
 * Paddle before Precifio performs ANY credit operation.
 *
 * NEVER process a Paddle webhook before verification.
 *
 * ============================================================
 */

const {
  Paddle,
  Environment,
} = require("@paddle/paddle-node-sdk");


let paddleClient = null;


/**
 * Lazily create the Paddle client.
 *
 * Keeping this lazy prevents environment configuration from
 * being evaluated during unrelated function imports.
 */
function getPaddleClient() {

  if (paddleClient) {
    return paddleClient;
  }

  const apiKey =
    process.env.PADDLE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "PADDLE_API_KEY is not configured."
    );
  }

  const env =
    String(
      process.env.PADDLE_ENVIRONMENT ||
      "sandbox"
    ).trim().toLowerCase() === "production"
      ? Environment.production
      : Environment.sandbox;

  paddleClient =
    new Paddle(
      apiKey,
      { environment: env }
    );

  return paddleClient;
}


/**
 * Verify and parse a Paddle webhook.
 *
 * IMPORTANT:
 *
 * rawBody MUST be the original request body.
 *
 * Do not JSON.parse() and then JSON.stringify() it before
 * verification.
 */
async function verifyPaddleWebhook({
  rawBody,
  signature,
} = {}) {

  if (!rawBody) {
    throw new Error(
      "Missing Paddle webhook request body."
    );
  }

  if (!signature) {
    throw new Error(
      "Missing Paddle-Signature header."
    );
  }

  const secret =
    process.env.PADDLE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "PADDLE_WEBHOOK_SECRET is not configured."
    );
  }

  const paddle =
    getPaddleClient();

  return paddle.webhooks.unmarshal(
    rawBody,
    secret,
    signature
  );
}


module.exports = {
  verifyPaddleWebhook,
};