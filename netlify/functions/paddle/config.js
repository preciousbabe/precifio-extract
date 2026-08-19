"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE SERVER CONFIGURATION
 * ============================================================
 *
 * Centralized backend configuration.
 *
 * No VITE_ variables belong here.
 *
 * ============================================================
 */

const PADDLE_ENVIRONMENT =
  String(
    process.env.PADDLE_ENVIRONMENT ||
    "sandbox"
  ).trim().toLowerCase();


if (
  PADDLE_ENVIRONMENT !== "sandbox" &&
  PADDLE_ENVIRONMENT !== "production"
) {
  throw new Error(
    `Invalid PADDLE_ENVIRONMENT: ${PADDLE_ENVIRONMENT}`
  );
}


/**
 * Paddle API base URL.
 *
 * We aren't using this directly for the webhook verification
 * yet, but keeping the environment explicit prevents accidental
 * sandbox/live mixing later.
 */
const PADDLE_API_BASE_URL =
  PADDLE_ENVIRONMENT === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";


module.exports = {
  PADDLE_ENVIRONMENT,
  PADDLE_API_BASE_URL,
};