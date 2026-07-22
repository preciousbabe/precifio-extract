"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Export Types
 * ------------------------------------------------------------------------
 *
 * Central definition of every supported export format.
 *
 * This file is the single source of truth for:
 *   • MIME types
 *   • File extensions
 *   • Display names
 *
 * Every exporter and upload provider should use these constants
 * instead of hardcoding strings.
 * ------------------------------------------------------------------------
 */

const TYPES = Object.freeze({

  json: Object.freeze({

    id: "json",

    displayName: "JSON",

    extension: "json",

    mimeType: "application/json"

  }),

  csv: Object.freeze({

    id: "csv",

    displayName: "CSV",

    extension: "csv",

    mimeType: "text/csv"

  }),

  excel: Object.freeze({

    id: "excel",

    displayName: "Excel",

    extension: "xlsx",

    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

  }),

  pdf: Object.freeze({

    id: "pdf",

    displayName: "PDF",

    extension: "pdf",

    mimeType: "application/pdf"

  }),

  docx: Object.freeze({

  id: "docx",

  displayName: "Word",

  extension: "docx",

  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

}) 

});

/**
 * Get export type definition.
 */
function get(format) {

  const type =
    TYPES[String(format || "").toLowerCase()];

  if (!type) {

    throw new Error(
      `Unsupported export format: ${format}`
    );

  }

  return type;

}

/**
 * Check whether a format exists.
 */
function exists(format) {

  return Boolean(
    TYPES[String(format || "").toLowerCase()]
  );

}

/**
 * List every export type.
 */
function list() {

  return Object.values(TYPES);

}

/**
 * List supported format ids.
 */
function ids() {

  return Object.keys(TYPES);

}

module.exports = Object.freeze({

  TYPES,

  get,

  exists,

  list,

  ids

});