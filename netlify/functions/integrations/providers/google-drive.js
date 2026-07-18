"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Upload a file to Google Drive.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Google Drive API.
 *
 * OAuth:
 *   integrations/oauth/google-drive.js
 *
 * File preparation / export formatting:
 *   send-to-google-drive.js
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {Object|string} options.metadata
 * @param {Buffer|string} options.file
 * @param {string} options.boundary
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
    boundary,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Google Drive access token.");
  }

  if (!validation.isNonEmptyString(boundary)) {
    throw new Error("Missing multipart boundary.");
  }

  if (!metadata) {
    throw new Error("Missing Google Drive metadata.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  const multipartBody =
    [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      typeof metadata === "string"
        ? metadata
        : JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/octet-stream",
      "",
      file,
      `--${boundary}--`
    ].join("\r\n");

  logger.info("Uploading file to Google Drive.", {
    provider: "google-drive"
  });

  const response = await http.post(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    multipartBody,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      }
    }
  );

  logger.info("Google Drive upload completed.", {
    provider: "google-drive",
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  upload
});