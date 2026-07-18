"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * Microsoft OneDrive OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *
 * Token persistence is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

const TOKEN_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const DEFAULT_SCOPES = [
  "offline_access",
  "Files.ReadWrite"
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
    throw new Error("Missing Microsoft client ID.");
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

    response_type: "code",

    redirect_uri: redirectUri,

    response_mode: "query",

    scope: scopes.join(" "),

    state,

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