"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send an extraction payload to a generic webhook endpoint.
 *
 * @param {Object} options
 * @param {string} options.url
 * @param {Object} options.payload
 * @param {Object} [options.headers]
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {
  const {
    url,
    payload,
    headers = {},
    timeout,
    retries
  } = options;

  if (!validation.isValidUrl(url)) {
    throw new Error("Invalid webhook URL.");
  }

  if (!validation.isPayloadWithinLimit(payload)) {
    throw new Error("Webhook payload exceeds the maximum allowed size.");
  }

  logger.info("Sending webhook.", {
    provider: "webhook",
    destination: new URL(url).origin
  });

  const response = await http.post(
    url,
    {
      event: "extraction.completed",
      timestamp: new Date().toISOString(),
      payload
    },
    {
      headers,
      timeout,
      retries
    }
  );

  logger.info("Webhook delivered.", {
    provider: "webhook",
    destination: new URL(url).origin,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});