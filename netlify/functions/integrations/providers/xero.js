"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send a transformed payload to Xero.
 *
 * NOTE:
 * This provider only handles communication with Xero.
 * Payload transformation is handled in:
 *
 *   integrations/transforms/xero.js
 *
 * OAuth token acquisition/refresh is handled in:
 *
 *   integrations/oauth/xero.js
 *
 * @param {Object} options
 * @param {string} options.tenantId
 * @param {string} options.accessToken
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    tenantId,
    accessToken,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(tenantId)) {
    throw new Error("Missing Xero tenant ID.");
  }

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Xero access token.");
  }

  if (!validation.hasRequiredFields(payload, ["Invoices"])) {
    throw new Error("Invalid Xero payload.");
  }

  logger.info("Sending payload to Xero.", {
    provider: "xero",
    tenantId
  });

  const response = await http.post(
    "https://api.xero.com/api.xro/2.0/Invoices",
    payload,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Xero-Tenant-Id": tenantId
      }
    }
  );

  logger.info("Xero request completed.", {
    provider: "xero",
    tenantId,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});