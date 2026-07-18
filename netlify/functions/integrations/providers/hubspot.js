"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send a transformed payload to HubSpot.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the HubSpot CRM API.
 *
 * OAuth:
 *   integrations/oauth/hubspot.js
 *
 * Payload transformation:
 *   integrations/transforms/hubspot.js
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} options.objectType
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    accessToken,
    objectType,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing HubSpot access token.");
  }

  if (!validation.isNonEmptyString(objectType)) {
    throw new Error("Missing HubSpot object type.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid HubSpot payload.");
  }

  logger.info("Sending payload to HubSpot.", {
    provider: "hubspot",
    object: objectType
  });

  const endpoint =
    `https://api.hubapi.com/crm/v3/objects/${encodeURIComponent(objectType)}`;

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

  logger.info("HubSpot request completed.", {
    provider: "hubspot",
    object: objectType,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});