"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Create a page in a Notion database.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Notion API.
 *
 * OAuth:
 *   integrations/oauth/notion.js
 *
 * Payload transformation:
 *   integrations/transforms/notion.js (future)
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {Object} options.payload
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    accessToken,
    payload,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Notion access token.");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Notion payload.");
  }

  if (!validation.hasRequiredFields(payload, ["parent", "properties"])) {
    throw new Error(
      "Notion payload must contain 'parent' and 'properties'."
    );
  }

  logger.info("Sending payload to Notion.", {
    provider: "notion"
  });

  const response = await http.post(
    "https://api.notion.com/v1/pages",
    payload,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": "2022-06-28",
        Accept: "application/json"
      }
    }
  );

  logger.info("Notion request completed.", {
    provider: "notion",
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  send
});