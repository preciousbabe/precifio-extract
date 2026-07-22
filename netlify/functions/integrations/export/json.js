"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio JSON Exporter
 * ------------------------------------------------------------------------
 *
 * Converts an extraction model into a downloadable JSON document.
 *
 * Input:
 * {
 *   fileName,
 *   documentSummary,
 *   segments,
 *   metadata
 * }
 *
 * Output:
 * {
 *   buffer,
 *   mimeType,
 *   extension,
 *   fileName
 * }
 * ------------------------------------------------------------------------
 */

const utils = require("./utils");
const types = require("./types");

const TYPE = types.get("json");

/**
 * Generate a JSON export.
 *
 * @param {Object} model
 * @returns {Promise<Object>}
 */
async function exportJSON(model = {}) {

  if (!model || typeof model !== "object") {
    throw new Error("Export model is required.");
  }

  const document = {

    fileName:
      model.fileName || "document",

    documentSummary:
      model.documentSummary || "",

    metadata:
      model.metadata || {},

    segments:
      model.segments || [],

    export: utils.buildExportMetadata(model)

  };

  const json =
    JSON.stringify(document, null, 2);

  return {

    buffer:
      utils.toBuffer(json),

    mimeType:
      TYPE.mimeType,

    extension:
      TYPE.extension,

    fileName:
      utils.buildFileName(
        model.fileName,
        TYPE.extension
      )

  };

}

module.exports = exportJSON;