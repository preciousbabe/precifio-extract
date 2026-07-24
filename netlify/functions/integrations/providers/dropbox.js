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
 * @param {Object|string} options.metadata
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
    metadata,
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

  if (!metadata) {
    throw new Error("Missing Dropbox metadata.");
  }

  if (!file) {
    throw new Error("Missing file.");
  }

  const fileName = typeof metadata === "string"
    ? JSON.parse(metadata).name
    : metadata.name;

  const path = `/${fileName}`;

  logger.info("Uploading file to Dropbox.", {
    provider: "dropbox",
    fileName
  });

  console.log("================================");
  console.log("UPLOADING TO DROPBOX");
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

  console.log("================================");
  console.log("DROPBOX RESPONSE");
  console.log("================================");

  console.log(response.data);

  logger.info("Dropbox upload completed.", {
    provider: "dropbox",
    fileName,
    status: response.status
  });

  return response;
}

module.exports = Object.freeze({
  upload
});