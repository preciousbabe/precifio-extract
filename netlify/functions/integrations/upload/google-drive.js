"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Google Drive Upload Adapter
 * ------------------------------------------------------------------------
 *
 * Converts a generic export object into the multipart upload
 * required by the Google Drive API.
 *
 * Input:
 *
 * {
 *   connection,
 *   exportFile
 * }
 *
 * exportFile:
 * {
 *    buffer,
 *    mimeType,
 *    extension,
 *    fileName
 * }
 *
 * ------------------------------------------------------------------------
 */

const crypto = require("crypto");

const provider =
  require("../providers/google-drive");

/**
 * Upload file to Google Drive.
 */
async function upload(options = {}) {

  const {
    connection,
    exportFile
  } = options;

  if (!connection) {
    throw new Error(
      "Google Drive connection is required."
    );
  }

  if (!exportFile) {
    throw new Error(
      "Export file is required."
    );
  }

  const {

  buffer,

  mimeType,

  fileName

} = exportFile;

if (!buffer) {
  throw new Error(
    "Export buffer is missing."
  );
}

console.log("================================");
console.log("GOOGLE DRIVE ADAPTER");
console.log("================================");

console.log({
  hasConnection: !!connection,
  hasAccessToken: !!connection.access_token,
  fileName,
  mimeType,
  size: buffer.length
});

  /*
   * Google multipart boundary.
   */

  const boundary =
    "precifio-" +
    crypto.randomUUID();

  /*
   * Google Drive metadata.
   */

  const metadata = {

    name: fileName,

    mimeType

  };

  /*
   * Delegate upload.
   */

  const response =
    await provider.upload({

      accessToken:
        connection.access_token,

      metadata,

      file: buffer,

      boundary

    });

  return {

    uploaded: true,

    provider:
      "google-drive",

    fileName,

    fileId:
      response.data.id,

    webViewLink:
      response.data.webViewLink ||

      null,

    webContentLink:
      response.data.webContentLink ||

      null,

    raw:
      response.data

  };

}

module.exports = Object.freeze({

  upload

});