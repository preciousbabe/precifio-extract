"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio CSV Exporter
 * ------------------------------------------------------------------------
 *
 * Converts extracted document data into a spreadsheet-friendly CSV.
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

const TYPE = types.get("csv");

/**
 * Escape CSV values.
 */
function escapeCSV(value) {

  const text = utils.sanitizeValue(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {

    return `"${text.replace(/"/g, '""')}"`;

  }

  return text;

}

/**
 * Convert rows to CSV.
 */
function rowsToCSV(rows = []) {

  if (!rows.length) {

    return "Section,Field,Value,Confidence";

  }

  const headers = Object.keys(rows[0]);

  const lines = [

    headers.join(",")

  ];

  for (const row of rows) {

    lines.push(

      headers
        .map(key => escapeCSV(row[key]))
        .join(",")

    );

  }

  return lines.join("\n");

}

/**
 * Generate CSV export.
 */
async function exportCSV(model = {}) {

  if (!model || typeof model !== "object") {

    throw new Error("Export model is required.");

  }

  const rows =
    utils.segmentsToRows(
      model.segments
    );

  const csv =
    rowsToCSV(rows);

  return {

    buffer:
      utils.toBuffer(csv),

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

module.exports = exportCSV;