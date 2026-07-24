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
 * @param {Object|string} options.metadata
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
    metadata,
    file,
    conflictBehavior = "replace",
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing OneDrive access token.");
  }

  if (!metadata) {
    throw new Error("Missing OneDrive metadata.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  const fileName = typeof metadata === "string"
    ? JSON.parse(metadata).name
    : metadata.name;

  const encodedPath = `/${fileName}`
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  logger.info("Uploading file to OneDrive.", {
    provider: "onedrive",
    fileName
  });

  console.log("================================");
  console.log("UPLOADING TO ONEDRIVE");
  console.log("================================");

  console.log({
    fileName,
    mimeType: typeof metadata === "string"
      ? JSON.parse(metadata).mimeType
      : metadata.mimeType,
    size: Buffer.isBuffer(file)
      ? file.length
      : String(file).length
  });

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

  console.log("================================");
  console.log("ONEDRIVE RESPONSE");
  console.log("================================");

  console.log(response.data);

  logger.info("OneDrive upload completed.", {
    provider: "onedrive",
    fileName,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  upload
});