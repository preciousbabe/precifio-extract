"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Export Utilities
 * ------------------------------------------------------------------------
 *
 * Shared helpers used by every export format.
 *
 * Responsibilities:
 *   • Build safe filenames
 *   • Sanitize values
 *   • Flatten extraction segments
 *   • Convert segments into tabular rows
 *   • Buffer conversion
 *
 * No provider-specific logic belongs here.
 * ------------------------------------------------------------------------
 */

/**
 * Replace unsafe filename characters.
 */
function sanitizeFileName(name = "document") {

  return String(name)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");

}

/**
 * Build export filename.
 */
function buildFileName(name, extension) {

  const safeName =
    sanitizeFileName(name || "document");

  const ext =
    String(extension || "")
      .replace(/^\./, "");

  return ext
    ? `${safeName}.${ext}`
    : safeName;

}

/**
 * Convert undefined/null values.
 */
function sanitizeValue(value) {

  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);

}

/**
 * Convert string into Buffer.
 */
function toBuffer(value) {

  if (Buffer.isBuffer(value)) {
    return value;
  }

  return Buffer.from(
    String(value),
    "utf8"
  );

}

/**
 * Flatten all extracted fields.
 *
 * Returns:
 * [
 *   {
 *      section,
 *      label,
 *      value,
 *      confidence
 *   }
 * ]
 */
function flattenSegments(segments = []) {

  const rows = [];

  for (const segment of segments) {

    const section =
      segment.segment_name || "General";

    for (const field of segment.fields || []) {

      rows.push({

        section,

        label:
          field.label || "",

        value:
          sanitizeValue(field.value),

        confidence:
          field.confidence ?? null

      });

    }

  }

  return rows;

}

/**
 * Convert extraction into rows.
 *
 * Perfect for:
 *   CSV
 *   Excel
 */
function segmentsToRows(segments = []) {

  return flattenSegments(segments).map(row => ({

    Section:
      row.section,

    Field:
      row.label,

    Value:
      row.value,

    Confidence:
      row.confidence

  }));

}

/**
 * Build export metadata.
 */
function buildExportMetadata(model = {}) {

  return {

    fileName:
      model.fileName || "document",

    documentSummary:
      model.documentSummary || "",

    metadata:
      model.metadata || {},

    generatedAt:
      new Date().toISOString()

  };

}


/**
 * Determine whether a segment represents a table.
 */
function isTableSegment(segment = {}) {

  const fields = segment.fields || [];

  if (!fields.length) {
    return false;
  }

  return fields.every(field =>
    field &&
    typeof field === "object" &&
    Array.isArray(field.value)
  );

}

/**
 * Extract table rows.
 *
 * Expected shape:
 *
 * fields:
 * [
 *   {
 *      label:"Line Items",
 *      value:[
 *          { Item:"Laptop", Qty:2 },
 *          { Item:"Mouse", Qty:1 }
 *      ]
 *   }
 * ]
 */
function extractTableRows(segment = {}) {

  const tables = [];

  for (const field of segment.fields || []) {

    if (!Array.isArray(field.value)) {
      continue;
    }

    tables.push({

      section:
        segment.segment_name || "Table",

      title:
        field.label || "Table",

      rows:
        field.value

    });

  }

  return tables;

}

/**
 * Convert all extraction data into workbook sheets.
 *
 * Returns:
 *
 * [
 *   {
 *      name,
 *      rows
 *   }
 * ]
 */
function segmentsToWorkbook(segments = []) {

  const sheets = [];

  const summaryRows = [];

  for (const segment of segments) {

    if (isTableSegment(segment)) {

      const tables =
        extractTableRows(segment);

      for (const table of tables) {

        sheets.push({

          name: table.title,

          rows: table.rows

        });

      }

      continue;

    }

    for (const field of segment.fields || []) {

      summaryRows.push({

        Section:
          segment.segment_name,

        Field:
          field.label,

        Value:
          sanitizeValue(field.value),

        Confidence:
          field.confidence

      });

    }

  }

  sheets.unshift({

    name: "Summary",

    rows: summaryRows

  });

  return sheets;

}

/**
 * Normalize export model.
 */
function normalizeModel(model = {}) {

  return {

    fileName:
      model.fileName || "document",

    documentSummary:
      model.documentSummary || "",

    metadata:
      model.metadata || {},

    segments:
      Array.isArray(model.segments)
        ? model.segments
        : []

  };

}


module.exports = Object.freeze({

  sanitizeFileName,

  buildFileName,

  sanitizeValue,

  normalizeModel,

  toBuffer,

  flattenSegments,

  segmentsToRows,

  buildExportMetadata,

  isTableSegment,

  extractTableRows,

  segmentsToWorkbook

});