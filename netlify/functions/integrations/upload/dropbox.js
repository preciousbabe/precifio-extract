"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Dropbox Upload Adapter
 * ------------------------------------------------------------------------
 *
 * Converts a generic export object into a Dropbox upload request.
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

const provider =
  require("../providers/dropbox");

/**
 * Upload file to Dropbox.
 */
async function upload(options = {}) {

  const {
    connection,
    exportFile
  } = options;

  if (!connection) {
    throw new Error(
      "Dropbox connection is required."
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
  console.log("DROPBOX ADAPTER");
  console.log("================================");

  console.log({
    hasConnection: !!connection,
    hasAccessToken: !!connection.access_token,
    fileName,
    mimeType,
    size: buffer.length
  });

  /*
   * Dropbox metadata.
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

      file: buffer

    });

  return {

    uploaded: true,

    provider:
      "dropbox",

    fileName,

    fileId:
      response.data.id ||

      null,

    path:
      response.data.path_display ||

      response.data.path_lower ||

      null,

    sharedLink:
      response.data.url ||

      null,

    raw:
      response.data

  };
}

module.exports = Object.freeze({

  upload

});