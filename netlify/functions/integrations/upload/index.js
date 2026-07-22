"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Upload Engine
 * ------------------------------------------------------------------------
 *
 * Generic upload dispatcher.
 *
 * Every upload provider receives the SAME export object:
 *
 * {
 *   buffer,
 *   mimeType,
 *   extension,
 *   fileName
 * }
 *
 * The upload engine converts that into the provider-specific
 * request before calling the provider implementation.
 *
 * Google Drive
 * Dropbox
 * OneDrive
 * Box
 * SharePoint
 * ...
 *
 * No provider-specific logic belongs in send-integration.js
 * ------------------------------------------------------------------------
 */

const registry = require("../registry");

const googleDrive = require("./google-drive");
const dropbox = require("./dropbox");
const oneDrive = require("./onedrive");

/**
 * Upload exported file.
 *
 * @param {Object} options
 * @param {String} options.provider
 * @param {Object} options.connection
 * @param {Object} options.exportFile
 *
 * @returns {Promise<Object>}
 */
async function send(options = {}) {

  const {
    provider,
    connection,
    exportFile
  } = options;

  if (!provider) {
    throw new Error("Provider is required.");
  }

  if (!connection) {
    throw new Error("Integration connection is required.");
  }

  if (!exportFile) {
    throw new Error("Export file is required.");
  }

  if (!registry.supportsUpload(provider)) {
    throw new Error(
      `${provider} does not support uploads.`
    );
  }

  switch (provider) {

    case "google-drive":
      return googleDrive.upload({
        connection,
        exportFile
      });

    case "dropbox":
      return dropbox.upload({
        connection,
        exportFile
      });

    case "onedrive":
      return oneDrive.upload({
        connection,
        exportFile
      });

    default:

      throw new Error(
        `Unsupported upload provider: ${provider}`
      );

  }

}

/**
 * Check upload support.
 */
function supports(provider) {

  return registry.supportsUpload(provider);

}

/**
 * Supported upload providers.
 */
function listProviders() {

  return [

    "google-drive",

    "dropbox",

    "onedrive"

  ];

}

module.exports = Object.freeze({

  send,

  supports,

  listProviders

});