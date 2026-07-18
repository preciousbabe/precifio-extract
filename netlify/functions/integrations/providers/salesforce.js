"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Send a transformed payload to Salesforce.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Salesforce REST API.
 *
 * OAuth:
 *   integrations/oauth/salesforce.js
 *
 * Payload transformation:
 *   integrations/transforms/salesforce.js
 *
 * @param {Object} options
 * @param {string} options.instanceUrl
 * @param {string} options.accessToken
 * @param {string} options.objectName
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    instanceUrl,
    accessToken,
    objectName,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isValidUrl(instanceUrl)) {
    throw new Error("Invalid Salesforce instance URL.");
  }

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Salesforce access token.");
  }

  if (!validation.isNonEmptyString(objectName)) {
    throw new Error("Missing Salesforce object name.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Salesforce payload.");
  }

  logger.info("Sending payload to Salesforce.", {
    provider: "salesforce",
    object: objectName
  });

  const endpoint =
    `${instanceUrl.replace(/\/$/, "")}/services/data/v61.0/sobjects/${encodeURIComponent(objectName)}`;

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

  logger.info("Salesforce request completed.", {
    provider: "salesforce",
    object: objectName,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});