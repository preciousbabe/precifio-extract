"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send a formatted message to a Slack Incoming Webhook.
 *
 * @param {Object} options
 * @param {string} options.url
 * @param {string} options.text
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {
  const {
    url,
    text,
    timeout,
    retries
  } = options;

  if (!validation.isValidUrl(url)) {
    throw new Error("Invalid Slack webhook URL.");
  }

  if (!validation.isNonEmptyString(text)) {
    throw new Error("Slack message cannot be empty.");
  }

  logger.info("Sending Slack message.", {
    provider: "slack",
    destination: new URL(url).origin
  });

  const response = await http.post(
    url,
    {
      text
    },
    {
      timeout,
      retries
    }
  );

  logger.info("Slack message delivered.", {
    provider: "slack",
    destination: new URL(url).origin,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});