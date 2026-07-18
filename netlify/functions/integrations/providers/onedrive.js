"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Upload a file to Microsoft OneDrive.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Microsoft Graph API.
 *
 * OAuth:
 *   integrations/oauth/onedrive.js
 *
 * File preparation / export formatting:
 *   send-to-onedrive.js
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} options.path
 * @param {Buffer|string|Uint8Array} options.file
 * @param {string} [options.conflictBehavior]
 * @param {number} [options.timeout]
 * @param {number} [options.retries]
 *
 * @returns {Promise<Object>}
 */
async function upload(options = {}) {

  const {
    accessToken,
    path,
    file,
    conflictBehavior = "replace",
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing OneDrive access token.");
  }

  if (!validation.isNonEmptyString(path)) {
    throw new Error("Missing OneDrive destination path.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  logger.info("Uploading file to OneDrive.", {
    provider: "onedrive",
    path
  });

  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const endpoint =
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content?@microsoft.graph.conflictBehavior=${encodeURIComponent(conflictBehavior)}`;

  const response = await http.put(
    endpoint,
    file,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream"
      }
    }
  );

  logger.info("OneDrive upload completed.", {
    provider: "onedrive",
    path,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  upload
});