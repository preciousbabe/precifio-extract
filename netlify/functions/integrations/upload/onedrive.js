"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio OneDrive Upload Adapter
 * ------------------------------------------------------------------------
 *
 * Converts a generic export object into a OneDrive upload request.
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
  require("../providers/onedrive");

/**
 * Upload file to OneDrive.
 */
async function upload(options = {}) {

  const {
    connection,
    exportFile
  } = options;

  if (!connection) {
    throw new Error(
      "OneDrive connection is required."
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
  console.log("ONEDRIVE ADAPTER");
  console.log("================================");

  console.log({
    hasConnection: !!connection,
    hasAccessToken: !!connection.access_token,
    fileName,
    mimeType,
    size: buffer.length
  });

  /*
   * OneDrive metadata.
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
      "onedrive",

    fileName,

    fileId:
      response.data.id,

    webUrl:
      response.data.webUrl ||

      null,

    webContentLink:
      response.data["@microsoft.graph.downloadUrl"] ||

      null,

    raw:
      response.data

  };
}

module.exports = Object.freeze({

  upload

});