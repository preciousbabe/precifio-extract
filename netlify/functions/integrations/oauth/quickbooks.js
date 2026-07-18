"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

/**
 * QuickBooks OAuth helper.
 *
 * Responsibilities:
 *   • Build authorization URL
 *   • Exchange authorization code
 *   • Refresh access token
 *   • Revoke token
 *
 * This module is stateless.
 * Token persistence is handled by the calling Netlify function.
 */

const AUTHORIZE_URL =
  "https://appcenter.intuit.com/connect/oauth2";

const TOKEN_URL =
  "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

const REVOKE_URL =
  "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

const DEFAULT_SCOPES = [
  "com.intuit.quickbooks.accounting"
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
    throw new Error("Missing QuickBooks client ID.");
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
          "application/x-www-form-urlencoded",

        Accept: "application/json"

      }

    }

  );

  return response.data;

}

/**
 * Refresh access token.
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
          "application/x-www-form-urlencoded",

        Accept: "application/json"

      }

    }

  );

  return response.data;

}

/**
 * Revoke refresh token.
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