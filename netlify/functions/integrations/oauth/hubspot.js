"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * HubSpot OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *   • Revoke refresh token
 *
 * Token persistence is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://app.hubspot.com/oauth/authorize";

const TOKEN_URL =
  "https://api.hubapi.com/oauth/v1/token";

const REVOKE_URL =
  "https://api.hubapi.com/oauth/v1/refresh-tokens/:token";

const DEFAULT_SCOPES = [
  "crm.objects.contacts.write",
  "crm.objects.companies.write",
  "crm.objects.deals.write",
  "crm.objects.custom.write",
  "oauth"
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
    throw new Error("Missing HubSpot client ID.");
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
 * Revoke a refresh token.
 */
async function revokeToken(options = {}) {

  const {
    refreshToken,
    timeout,
    retries
  } = options;

  if (!validation.isNonEmptyString(refreshToken)) {
    throw new Error("Missing HubSpot refresh token.");
  }

  const endpoint =
    REVOKE_URL.replace(
      ":token",
      encodeURIComponent(refreshToken)
    );

  const response = await http.delete(
    endpoint,
    {
      timeout,
      retries,
      headers: {
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