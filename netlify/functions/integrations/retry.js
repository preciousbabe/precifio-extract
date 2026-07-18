/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/retry.js
 *
 * Purpose:
 *   Generic retry helper shared across every integration.
 *
 * IMPORTANT
 * ----------
 * This module knows NOTHING about:
 *
 *   • HTTP
 *   • fetch()
 *   • Webhooks
 *   • Slack
 *   • Xero
 *   • QuickBooks
 *   • OAuth
 *
 * It simply retries asynchronous work.
 * ------------------------------------------------------------------------
 */

"use strict";

const {
  MAX_RETRIES,
  RETRY_BACKOFF_MS
} = require("./constants");

const logger = require("./logger");

/**
 * Pause execution.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation.
 *
 * @param {Function} operation
 *        Async function to execute.
 *
 * @param {Object} options
 *        Optional configuration.
 */
async function retry(operation, options = {}) {

  const retries =
    Number.isInteger(options.retries)
      ? options.retries
      : MAX_RETRIES;

  const baseDelay =
    Number.isFinite(options.delay)
      ? options.delay
      : RETRY_BACKOFF_MS;

  const shouldRetry =
    typeof options.shouldRetry === "function"
      ? options.shouldRetry
      : () => true;

  let attempt = 0;
  let lastError;

  while (attempt <= retries) {

    try {

      return await operation();

    } catch (error) {

      lastError = error;

      if (!shouldRetry(error, attempt)) {
        throw error;
      }

      if (attempt === retries) {
        break;
      }

      const waitTime =
        baseDelay * Math.pow(2, attempt);

      logger.warn(
        "Retrying operation.",
        {
          attempt: attempt + 1,
          retries,
          delay: waitTime,
          error: error.message
        }
      );

      await sleep(waitTime);

      attempt++;

    }

  }

  logger.error(
    "Retry attempts exhausted.",
    {
      retries,
      error: lastError?.message
    }
  );

  throw lastError;

}

/**
 * Export helpers.
 */
module.exports = Object.freeze({

  retry,

  sleep

});