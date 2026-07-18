/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/utils.js
 *
 * Purpose:
 *   Generic reusable helper functions.
 *
 * IMPORTANT
 * ----------
 * This file must NEVER contain:
 *
 *   • HTTP logic
 *   • OAuth logic
 *   • Provider-specific code
 *   • Logging
 *   • Validation logic
 *
 * Only generic reusable utilities belong here.
 * ------------------------------------------------------------------------
 */

"use strict";

const crypto = require("crypto");

/**
 * Generate a cryptographically secure random ID.
 */
function generateId(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Generate a UUID.
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Deep clone an object.
 */
function deepClone(value) {
  return structuredClone(value);
}

/**
 * Remove undefined values recursively.
 */
function removeUndefined(value) {

  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === "object") {

    return Object.fromEntries(

      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, removeUndefined(v)])

    );

  }

  return value;

}

/**
 * Safely stringify JSON.
 */
function safeStringify(value, space = 2) {

  try {

    return JSON.stringify(value, null, space);

  } catch {

    return "{}";

  }

}

/**
 * Safe JSON parse.
 */
function safeParse(text, fallback = null) {

  try {

    return JSON.parse(text);

  } catch {

    return fallback;

  }

}

/**
 * Remove file extension.
 */
function stripExtension(filename = "") {

  return filename.replace(/\.[^.]+$/, "");

}

/**
 * Normalize filenames.
 */
function normalizeFilename(filename = "") {

  return filename

    .trim()

    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")

    .replace(/\s+/g, " ");

}

/**
 * Truncate text safely.
 */
function truncate(text = "", maxLength = 500) {

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + "...";

}

/**
 * Delay helper.
 */
function sleep(ms) {

  return new Promise(resolve => {

    setTimeout(resolve, ms);

  });

}

/**
 * Timestamp helper.
 */
function nowISO() {

  return new Date().toISOString();

}

/**
 * Merge objects without mutating.
 */
function merge(...objects) {

  return Object.assign({}, ...objects);

}

module.exports = Object.freeze({

  generateId,

  generateUUID,

  deepClone,

  removeUndefined,

  safeStringify,

  safeParse,

  stripExtension,

  normalizeFilename,

  truncate,

  sleep,

  nowISO,

  merge

});