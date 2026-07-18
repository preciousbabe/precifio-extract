"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * Xero OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *   • Revoke token (disconnect)
 *
 * Does NOT persist anything.
 * Storage is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://login.xero.com/identity/connect/authorize";

const TOKEN_URL =
  "https://identity.xero.com/connect/token";

const REVOKE_URL =
  "https://identity.xero.com/connect/revocation";

const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.transactions"
];

/**
 * Build the OAuth authorization URL.
 */
function buildAuthorizationUrl(options = {}) {

  const {
    clientId,
    redirectUri,
    state,
    scopes = DEFAULT_SCOPES
  } = options;

  if (!validation.isNonEmptyString(clientId)) {
    throw new Error("Missing Xero client ID.");
  }

  if (!validation.isValidUrl(redirectUri)) {
    throw new Error("Invalid redirect URI.");
  }

  if (!validation.isNonEmptyString(state)) {
    throw new Error("Missing OAuth state.");
  }

  const verifier = auth.generateCodeVerifier();

  const challenge =
    auth.generateCodeChallenge(verifier);

  const params = new URLSearchParams({

    response_type: "code",

    client_id: clientId,

    redirect_uri: redirectUri,

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
 * Exchange authorization code for tokens.
 */
async function exchangeCode(options = {}) {

  const {
    clientId,
    clientSecret,
    redirectUri,
    code,
    codeVerifier,
    timeout,
    retries
  } = options;

  const response = await http.post(

    TOKEN_URL,

    new URLSearchParams({

      grant_type: "authorization_code",

      code,

      redirect_uri: redirectUri,

      code_verifier: codeVerifier

    }).toString(),

    {

      timeout,

      retries,

      headers: {

        ...auth.basic(clientId, clientSecret),

        "Content-Type":
          "application/x-www-form-urlencoded"

      }

    }

  );

  return response.data;

}

/**
 * Refresh an access token.
 */
async function refreshToken(options = {}) {

  const {
    clientId,
    clientSecret,
    refreshToken,
    timeout,
    retries
  } = options;

  const response = await http.post(

    TOKEN_URL,

    new URLSearchParams({

      grant_type: "refresh_token",

      refresh_token: refreshToken

    }).toString(),

    {

      timeout,

      retries,

      headers: {

        ...auth.basic(clientId, clientSecret),

        "Content-Type":
          "application/x-www-form-urlencoded"

      }

    }

  );

  return response.data;

}

/**
 * Revoke a refresh token.
 */
async function revokeToken(options = {}) {

  const {
    clientId,
    clientSecret,
    refreshToken,
    timeout,
    retries
  } = options;

  const response = await http.post(

    REVOKE_URL,

    new URLSearchParams({

      token: refreshToken

    }).toString(),

    {

      timeout,

      retries,

      headers: {

        ...auth.basic(clientId, clientSecret),

        "Content-Type":
          "application/x-www-form-urlencoded"

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