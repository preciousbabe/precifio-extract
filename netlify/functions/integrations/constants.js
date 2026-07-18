/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/constants.js
 *
 * Purpose:
 *   Central configuration shared across every integration.
 *
 * IMPORTANT
 * ----------
 * This file must NEVER:
 *   • contain provider-specific logic
 *   • contain user data
 *   • contain extracted document data
 *   • contain API requests
 *   • contain OAuth implementation
 *
 * It should only export reusable constants.
 * ------------------------------------------------------------------------
 */

"use strict";

/**
 * Application information
 */
const APP_NAME = "Precifio";
const APP_VERSION = "1.0.0";
const USER_AGENT = `${APP_NAME} Integration Engine/${APP_VERSION}`;

/**
 * Request behaviour
 */
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

/**
 * Payload limits
 */
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Logging
 */
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/**
 * Security
 */
const REQUEST_ID_HEADER = "x-precifio-request-id";
const REQUEST_SOURCE_HEADER = "x-precifio-source";

/**
 * OAuth
 */
const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Default headers applied to outgoing requests
 */
const DEFAULT_HEADERS = Object.freeze({
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": USER_AGENT
});

/**
 * Supported integration providers
 *
 * Used for validation and routing.
 */
const SUPPORTED_PROVIDERS = Object.freeze([
  "webhook",
  "slack",
  "xero",
  "quickbooks",
  "google-drive",
  "dropbox",
  "onedrive",
  "notion",
  "airtable",
  "salesforce",
  "hubspot"
]);

/**
 * Export everything from one place.
 */
module.exports = Object.freeze({

  APP_NAME,
  APP_VERSION,

  USER_AGENT,

  DEFAULT_TIMEOUT,
  MAX_RETRIES,
  RETRY_BACKOFF_MS,

  MAX_PAYLOAD_SIZE,

  LOG_LEVEL,

  REQUEST_ID_HEADER,
  REQUEST_SOURCE_HEADER,

  OAUTH_STATE_EXPIRY_MS,

  DEFAULT_HEADERS,

  SUPPORTED_PROVIDERS

});