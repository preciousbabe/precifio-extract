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
    fileName
  } = exportFile;

  if (!buffer) {
    throw new Error(
      "Export buffer is missing."
    );
  }

  const response =
    await provider.upload({

      accessToken:
        connection.access_token,

      file: buffer,

      path:
        `/${fileName}`

    });

  return {

    uploaded: true,

    provider:
      "dropbox",

    fileName,

    fileId:
      response.data.id,

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