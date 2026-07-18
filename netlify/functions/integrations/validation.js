/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/validation.js
 *
 * Purpose:
 *   Generic validation helpers shared across every integration.
 *
 * IMPORTANT
 * ----------
 * This file must NEVER contain provider-specific validation.
 * It should only validate generic values used throughout the
 * integration engine.
 * ------------------------------------------------------------------------
 */

"use strict";

const {
  MAX_PAYLOAD_SIZE,
  SUPPORTED_PROVIDERS
} = require("./constants");

/**
 * Returns true if value is a non-empty string.
 */
function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/**
 * Validate provider name.
 */
function isSupportedProvider(provider) {
  return SUPPORTED_PROVIDERS.includes(provider);
}

/**
 * Validate URL.
 */
function isValidUrl(url) {
  if (!isNonEmptyString(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );
  } catch {
    return false;
  }
}

/**
 * Validate email address.
 */
function isValidEmail(email) {
  if (!isNonEmptyString(email)) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate payload size.
 */
function isPayloadWithinLimit(payload) {
  try {
    const bytes = Buffer.byteLength(
      JSON.stringify(payload),
      "utf8"
    );

    return bytes <= MAX_PAYLOAD_SIZE;
  } catch {
    return false;
  }
}

/**
 * Validate required fields.
 */
function hasRequiredFields(object, requiredFields = []) {

  if (
    !object ||
    typeof object !== "object"
  ) {
    return false;
  }

  return requiredFields.every(field => {

    const value = object[field];

    return value !== undefined &&
           value !== null;

  });

}

/**
 * Safely parse JSON.
 */
function safeJsonParse(text) {

  try {

    return {
      success: true,
      data: JSON.parse(text)
    };

  } catch {

    return {
      success: false,
      data: null
    };

  }

}

/**
 * Validate request body.
 */
function validateRequestBody(body) {

  if (!body) {

    return {
      valid: false,
      message: "Request body is missing."
    };

  }

  const parsed = safeJsonParse(body);

  if (!parsed.success) {

    return {
      valid: false,
      message: "Request body contains invalid JSON."
    };

  }

  if (
    !isPayloadWithinLimit(parsed.data)
  ) {

    return {
      valid: false,
      message: "Payload exceeds maximum allowed size."
    };

  }

  return {
    valid: true,
    data: parsed.data
  };

}

module.exports = Object.freeze({

  isNonEmptyString,

  isSupportedProvider,

  isValidUrl,

  isValidEmail,

  isPayloadWithinLimit,

  hasRequiredFields,

  safeJsonParse,

  validateRequestBody

});