/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/logger.js
 *
 * Purpose:
 *   Privacy-first logging shared across every integration.
 *
 * IMPORTANT
 * ----------
 * This logger MUST NEVER log:
 *
 *   • extracted documents
 *   • extracted text
 *   • extracted tables
 *   • request bodies
 *   • OAuth access tokens
 *   • refresh tokens
 *   • API keys
 *   • Authorization headers
 *   • webhook payloads
 *
 * Only operational metadata should be logged.
 * ------------------------------------------------------------------------
 */

"use strict";

const {
  APP_NAME,
  LOG_LEVEL
} = require("./constants");

/**
 * Log level priority
 */
const LEVELS = Object.freeze({
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
});

/**
 * Current log level
 */
const CURRENT_LEVEL =
  LEVELS[LOG_LEVEL] ?? LEVELS.info;

/**
 * Keys that should NEVER appear in logs.
 */
const SENSITIVE_KEYS = Object.freeze([
  "payload",
  "segments",
  "tables",
  "details",
  "document",
  "documentSummary",
  "fields",
  "text",
  "content",
  "body",
  "authorization",
  "Authorization",
  "access_token",
  "refresh_token",
  "token",
  "apiKey",
  "api_key",
  "secret",
  "password"
]);

/**
 * Replace sensitive values.
 */
function sanitize(value) {

  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return "[REDACTED ARRAY]";
  }

  if (typeof value !== "object") {
    return value;
  }

  const copy = {};

  for (const [key, val] of Object.entries(value)) {

    if (
      SENSITIVE_KEYS.includes(key)
    ) {

      copy[key] = "[REDACTED]";

      continue;

    }

    if (
      val &&
      typeof val === "object"
    ) {

      copy[key] = sanitize(val);

    } else {

      copy[key] = val;

    }

  }

  return copy;

}

/**
 * Format timestamp.
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Internal logger.
 */
function write(level, message, metadata = {}) {

  if (LEVELS[level] > CURRENT_LEVEL) {
    return;
  }

  const safeMetadata = sanitize(metadata);

  const entry = {

    timestamp: timestamp(),

    application: APP_NAME,

    level,

    message,

    metadata: safeMetadata

  };

  console[level](
    JSON.stringify(entry)
  );

}

/**
 * Info
 */
function info(message, metadata = {}) {
  write("info", message, metadata);
}

/**
 * Warning
 */
function warn(message, metadata = {}) {
  write("warn", message, metadata);
}

/**
 * Error
 */
function error(message, metadata = {}) {
  write("error", message, metadata);
}

/**
 * Debug
 */
function debug(message, metadata = {}) {
  write("debug", message, metadata);
}

module.exports = Object.freeze({

  info,

  warn,

  error,

  debug

});