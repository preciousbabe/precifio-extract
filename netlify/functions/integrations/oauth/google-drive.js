"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * Google Drive OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *
 * Token persistence is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

const TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/drive.file"
];

/**
 * Build OAuth authorization URL.
 */
function buildAuthorizationUrl(options = {}) {

  const {
    clientId,
    redirectUri,
    state,
    scopes = DEFAULT_SCOPES
  } = options;

  if (!validation.isNonEmptyString(clientId)) {
    throw new Error("Missing Google client ID.");
  }

  if (!validation.isValidUrl(redirectUri)) {
    throw new Error("Invalid redirect URI.");
  }

  if (!validation.isNonEmptyString(state)) {
    throw new Error("Missing OAuth state.");
  }

  const verifier =
    auth.generateCodeVerifier();

  const challenge =
    auth.generateCodeChallenge(verifier);

  const params = new URLSearchParams({

    client_id: clientId,

    redirect_uri: redirectUri,

    response_type: "code",

    scope: scopes.join(" "),

    state,

    access_type: "offline",

    prompt: "consent",

    code_challenge: challenge,

    code_challenge_method: "S256"

  });

  return {

    authorizationUrl:
      `${AUTHORIZE_URL}?${params.toString()}`,

    codeVerifier: verifier

  };

}

/**
 * Exchange authorization code.
 */
async function exchangeCode(options = {}) {

  return auth.exchangeAuthorizationCode({

    http,

    tokenUrl: TOKEN_URL,

    ...options

  });

}

/**
 * Refresh access token.
 */
async function refreshToken(options = {}) {

  return auth.refreshOAuthToken({

    http,

    tokenUrl: TOKEN_URL,

    ...options

  });

}

module.exports = Object.freeze({

  DEFAULT_SCOPES,

  buildAuthorizationUrl,

  exchangeCode,

  refreshToken

});