"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * Dropbox OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *   • Revoke access token
 *
 * Token persistence is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://www.dropbox.com/oauth2/authorize";

const TOKEN_URL =
  "https://api.dropboxapi.com/oauth2/token";

const REVOKE_URL =
  "https://api.dropboxapi.com/2/auth/token/revoke";

const DEFAULT_SCOPES = [
  "files.content.write"
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
    throw new Error("Missing Dropbox client ID.");
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

    token_access_type: "offline",

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

/**
 * Revoke access token.
 */
async function revokeToken(options = {}) {

  const {
    accessToken,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Dropbox access token.");
  }

  const response = await http.post(

    REVOKE_URL,

    undefined,

    {

      timeout,

      retries,

      headers: {

        ...auth.bearer(accessToken)

      }

    }

  );

  return response.data;

}

module.exports = Object.freeze({

  DEFAULT_SCOPES,

  buildAuthorizationUrl,

  exchangeCode,

  refreshToken,

  revokeToken

});