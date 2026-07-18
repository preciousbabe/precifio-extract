"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Create records in an Airtable table.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Airtable API.
 *
 * OAuth:
 *   integrations/oauth/airtable.js
 *
 * Payload transformation:
 *   integrations/transforms/airtable.js
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} options.baseId
 * @param {string} options.tableId
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    accessToken,
    baseId,
    tableId,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Airtable access token.");
  }

  if (!validation.isNonEmptyString(baseId)) {
    throw new Error("Missing Airtable Base ID.");
  }

  if (!validation.isNonEmptyString(tableId)) {
    throw new Error("Missing Airtable Table ID.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Airtable payload.");
  }

  if (!validation.hasRequiredFields(payload, ["records"])) {
    throw new Error("Airtable payload must contain 'records'.");
  }

  logger.info("Sending payload to Airtable.", {
    provider: "airtable",
    baseId,
    tableId
  });

  const endpoint =
    `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}`;

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

  logger.info("Airtable request completed.", {
    provider: "airtable",
    baseId,
    tableId,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});