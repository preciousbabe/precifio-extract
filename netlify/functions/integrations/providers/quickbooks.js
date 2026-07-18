"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send a transformed payload to QuickBooks Online.
 *
 * NOTE:
 * This provider only handles communication with QuickBooks.
 * Payload transformation is handled in:
 *
 *   integrations/transforms/quickbooks.js
 *
 * OAuth token acquisition/refresh is handled in:
 *
 *   integrations/oauth/quickbooks.js
 *
 * @param {Object} options
 * @param {string} options.realmId
 * @param {string} options.accessToken
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    realmId,
    accessToken,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(realmId)) {
    throw new Error("Missing QuickBooks Realm ID.");
  }

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing QuickBooks access token.");
  }

  if (!validation.hasRequiredFields(payload, ["Line"])) {
    throw new Error("Invalid QuickBooks payload.");
  }

  logger.info("Sending payload to QuickBooks.", {
    provider: "quickbooks",
    realmId
  });

  const endpoint =
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`;

  const response = await http.post(
    endpoint,
    payload,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }
  );

  logger.info("QuickBooks request completed.", {
    provider: "quickbooks",
    realmId,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});