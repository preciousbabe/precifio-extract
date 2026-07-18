"use strict";

const http = require("../http");
const logger = require("../logger");
const validation = require("../validation");

/**
 * Upload a file to Dropbox.
 *
 * NOTE:
 * This provider is responsible ONLY for communicating with
 * the Dropbox API.
 *
 * OAuth:
 *   integrations/oauth/dropbox.js
 *
 * File preparation / export formatting:
 *   send-to-dropbox.js
 *
 * @param {Object} options
 * @param {string} options.accessToken
 * @param {string} options.path
 * @param {Buffer|string|Uint8Array} options.file
 * @param {boolean} [options.overwrite]
 * @param {boolean} [options.autorename]
 * @param {boolean} [options.mute]
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
    overwrite = true,
    autorename = false,
    mute = false,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Dropbox access token.");
  }

  if (!validation.isNonEmptyString(path)) {
    throw new Error("Missing Dropbox destination path.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  logger.info("Uploading file to Dropbox.", {
    provider: "dropbox",
    path
  });

  const response = await http.post(
    "https://content.dropboxapi.com/2/files/upload",
    file,
    {
      timeout,
      retries,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path,
          mode: overwrite ? "overwrite" : "add",
          autorename,
          mute
        })
      }
    }
  );

  logger.info("Dropbox upload completed.", {
    provider: "dropbox",
    path,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  upload
});