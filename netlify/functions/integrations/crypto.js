/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/crypto.js
 *
 * Purpose:
 *   Generic encryption helpers for storing sensitive integration credentials.
 *
 * Responsibilities:
 *   - Encrypt OAuth access tokens
 *   - Encrypt OAuth refresh tokens
 *   - Encrypt API keys
 *   - Decrypt stored credentials
 *
 * This module contains NO provider-specific logic.
 * ------------------------------------------------------------------------
 */

"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const SECRET =
  process.env.INTEGRATION_ENCRYPTION_KEY;

if (!SECRET) {
  throw new Error(
    "Missing INTEGRATION_ENCRYPTION_KEY environment variable."
  );
}

/**
 * Derive a 32-byte encryption key.
 */
const KEY = crypto
  .createHash("sha256")
  .update(String(SECRET))
  .digest();

/**
 * Encrypt plain text.
 */
function encrypt(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    KEY,
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]);

  const authTag =
    cipher.getAuthTag();

  return JSON.stringify({

    iv: iv.toString("base64"),

    tag: authTag.toString("base64"),

    data: encrypted.toString("base64")

  });

}

/**
 * Decrypt previously encrypted text.
 */
function decrypt(value) {

  if (!value) {
    return null;
  }

  const payload =
    typeof value === "string"
      ? JSON.parse(value)
      : value;

  const decipher =
    crypto.createDecipheriv(

      ALGORITHM,

      KEY,

      Buffer.from(payload.iv, "base64")

    );

  decipher.setAuthTag(

    Buffer.from(
      payload.tag,
      "base64"
    )

  );

  const decrypted =
    Buffer.concat([

      decipher.update(

        Buffer.from(
          payload.data,
          "base64"
        )

      ),

      decipher.final()

    ]);

  return decrypted.toString("utf8");

}

/**
 * Determine whether a value appears encrypted.
 */
function isEncrypted(value) {

  if (!value || typeof value !== "string") {
    return false;
  }

  try {

    const parsed = JSON.parse(value);

    return Boolean(

      parsed.iv &&
      parsed.tag &&
      parsed.data

    );

  } catch {

    return false;

  }

}

module.exports = Object.freeze({

  encrypt,

  decrypt,

  isEncrypted

});