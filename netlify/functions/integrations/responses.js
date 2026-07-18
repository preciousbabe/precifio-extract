/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/responses.js
 *
 * Purpose:
 *   Standard response helpers shared by every integration.
 *
 * IMPORTANT
 * ----------
 * Never include:
 *   • extracted document data
 *   • OAuth tokens
 *   • request payloads
 *   • stack traces
 *   • internal implementation details
 * ------------------------------------------------------------------------
 */

"use strict";

/**
 * Common headers returned by every function.
 */
const DEFAULT_HEADERS = Object.freeze({
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0"
});

/**
 * Build a standard HTTP response.
 */
function buildResponse(statusCode, body = {}, headers = {}) {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers
    },
    body: JSON.stringify(body)
  };
}

/**
 * 200 OK
 */
function success(data = {}, message = "Success") {
  return buildResponse(200, {
    success: true,
    message,
    data
  });
}

/**
 * 201 Created
 */
function created(data = {}, message = "Created") {
  return buildResponse(201, {
    success: true,
    message,
    data
  });
}

/**
 * 400 Bad Request
 */
function badRequest(message = "Bad Request") {
  return buildResponse(400, {
    success: false,
    message
  });
}

/**
 * 401 Unauthorized
 */
function unauthorized(message = "Unauthorized") {
  return buildResponse(401, {
    success: false,
    message
  });
}

/**
 * 403 Forbidden
 */
function forbidden(message = "Forbidden") {
  return buildResponse(403, {
    success: false,
    message
  });
}

/**
 * 404 Not Found
 */
function notFound(message = "Not Found") {
  return buildResponse(404, {
    success: false,
    message
  });
}

/**
 * 408 Request Timeout
 */
function timeout(message = "Request Timeout") {
  return buildResponse(408, {
    success: false,
    message
  });
}

/**
 * 413 Payload Too Large
 */
function payloadTooLarge(message = "Payload Too Large") {
  return buildResponse(413, {
    success: false,
    message
  });
}

/**
 * 429 Too Many Requests
 */
function tooManyRequests(message = "Too Many Requests") {
  return buildResponse(429, {
    success: false,
    message
  });
}

/**
 * 500 Internal Server Error
 *
 * IMPORTANT:
 * Never expose the original error object.
 */
function serverError(message = "Internal Server Error") {
  return buildResponse(500, {
    success: false,
    message
  });
}

/**
 * 502 Bad Gateway
 */
function badGateway(message = "Bad Gateway") {
  return buildResponse(502, {
    success: false,
    message
  });
}

/**
 * 503 Service Unavailable
 */
function serviceUnavailable(message = "Service Unavailable") {
  return buildResponse(503, {
    success: false,
    message
  });
}

module.exports = Object.freeze({

  buildResponse,

  success,
  created,

  badRequest,
  unauthorized,
  forbidden,
  notFound,

  timeout,

  payloadTooLarge,

  tooManyRequests,

  serverError,

  badGateway,
  serviceUnavailable

});