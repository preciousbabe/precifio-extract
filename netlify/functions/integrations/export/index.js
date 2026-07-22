"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Export Engine
 * ------------------------------------------------------------------------
 *
 * Central dispatcher for every export format.
 *
 * Every exporter MUST return:
 *
 * {
 *   buffer,
 *   mimeType,
 *   extension,
 *   fileName
 * }
 *
 * This module contains NO provider-specific logic.
 * Google Drive, Dropbox, Email, Slack, etc.
 * all consume the same export object.
 * ------------------------------------------------------------------------
 */

const exportJSON = require("./json");
const exportCSV = require("./csv");
const exportExcel = require("./excel");
const exportPDF = require("./pdf");
const exportDOCX = require("./docx");

/**
 * Generate an export.
 *
 * @param {Object} options
 * @param {Object} options.model
 * @param {string} options.format
 *
 * @returns {Promise<{
 *   buffer: Buffer,
 *   mimeType: string,
 *   extension: string,
 *   fileName: string
 * }>}
 */
async function generateExport(options = {}) {

  const {
    model,
    format
  } = options;

  if (!model) {
    throw new Error("Export model is required.");
  }

  if (!format) {
    throw new Error("Export format is required.");
  }

  switch (String(format).toLowerCase()) {

    case "json":
      return exportJSON(model);

    case "csv":
      return exportCSV(model);

    case "excel":
    case "xlsx":
      return exportExcel(model);

    case "pdf":
      return exportPDF(model);
      
      case "docx":
    return exportDOCX(model);

    default:
      throw new Error(
        `Unsupported export format: ${format}`
      );

  }

}

/**
 * Check if a format is supported.
 */
function supports(format) {

  return [
  "json",
  "csv",
  "excel",
  "xlsx",
  "pdf",
  "docx"
].includes(
    String(format || "").toLowerCase()
  );

}

/**
 * List supported export formats.
 */
function listFormats() {

  return Object.freeze([
    "json",
    "csv",
    "excel",
    "pdf",
    "docx"
]);

}

module.exports = Object.freeze({

  generateExport,

  supports,

  listFormats

});