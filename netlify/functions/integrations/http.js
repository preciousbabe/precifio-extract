/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/http.js
 *
 * Purpose:
 *   Central HTTP client shared across every integration provider.
 *
 * IMPORTANT
 * ----------
 * Never log request bodies or response bodies.
 * Only operational metadata should be logged.
 * ------------------------------------------------------------------------
 */

"use strict";

const {
  DEFAULT_TIMEOUT,
  DEFAULT_HEADERS
} = require("./constants");

const logger = require("./logger");
const { retry } = require("./retry");

/**
 * Build request headers.
 */
function buildHeaders(headers = {}) {
  return {
    ...DEFAULT_HEADERS,
    ...headers
  };
}


/**
 * Normalize request body.
 *
 * Objects are JSON encoded.
 * Strings, Buffers, Uint8Arrays and other binary bodies are sent unchanged.
 */
function buildRequestBody(body) {

  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    Buffer.isBuffer(body) ||
    body instanceof Uint8Array
  ) {
    return body;
  }

  return JSON.stringify(body);

}

/**
 * Perform a single HTTP request.
 */
async function performRequest(options) {

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || DEFAULT_TIMEOUT
  );

  try {

    logger.info("Outgoing HTTP request.", {
      method: options.method,
      url: options.url
    });

    const response = await fetch(options.url, {

      method: options.method || "POST",

      headers: buildHeaders(options.headers),

      body: buildRequestBody(options.body),

      signal: controller.signal

    });

    clearTimeout(timeout);

    let data = null;

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {

      data = await response.json();

    } else {

      data = await response.text();

    }

    if (!response.ok) {

      const error = new Error(
        `HTTP ${response.status}`
      );

      error.status = response.status;

      throw error;

    }

    logger.info("HTTP request completed.", {
      method: options.method,
      url: options.url,
      status: response.status
    });

    return {

      status: response.status,

      headers: response.headers,

      data

    };

  } catch (error) {

    clearTimeout(timeout);

    logger.error("HTTP request failed.", {

      method: options.method,

      url: options.url,

      status: error.status,

      error: error.message

    });

    throw error;

  }

}

/**
 * Public request helper.
 */
async function request(options = {}) {

  return retry(

    () => performRequest(options),

    {

      retries: options.retries,

      delay: options.delay,

      shouldRetry(error) {

        if (error.name === "AbortError") {
          return true;
        }

        if (!error.status) {
          return true;
        }

        return error.status >= 500;

      }

    }

  );

}

/**
 * Convenience helpers.
 */

function get(url, options = {}) {

  return request({

    ...options,

    url,

    method: "GET"

  });

}

function post(url, body, options = {}) {

  return request({

    ...options,

    url,

    body,

    method: "POST"

  });

}

function put(url, body, options = {}) {

  return request({

    ...options,

    url,

    body,

    method: "PUT"

  });

}

function patch(url, body, options = {}) {

  return request({

    ...options,

    url,

    body,

    method: "PATCH"

  });

}

function del(url, options = {}) {

  return request({

    ...options,

    url,

    method: "DELETE"

  });

}

module.exports = Object.freeze({

  request,

  get,

  post,

  put,

  patch,

  del

});