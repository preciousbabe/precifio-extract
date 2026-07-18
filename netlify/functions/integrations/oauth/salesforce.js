"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * Salesforce OAuth helper.
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
  "https://login.salesforce.com/services/oauth2/authorize";

const TOKEN_URL =
  "https://login.salesforce.com/services/oauth2/token";

const REVOKE_URL =
  "https://login.salesforce.com/services/oauth2/revoke";

const DEFAULT_SCOPES = [
  "api",
  "refresh_token"
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
    throw new Error("Missing Salesforce client ID.");
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
 * Revoke an access token.
 */
async function revokeToken(options = {}) {

  const {
    accessToken,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(accessToken)) {
    throw new Error("Missing Salesforce access token.");
  }

  const response = await http.post(

    REVOKE_URL,

    new URLSearchParams({

      token: accessToken

    }).toString(),

    {

      timeout,

      retries,

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json"
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