"use strict";

const http = require("../http");
const auth = require("../auth");
const validation = require("../validation");

const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL     = "https://identity.xero.com/connect/token";
const REVOKE_URL    = "https://identity.xero.com/connect/revocation";

const DEFAULT_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.invoices",        
  "accounting.contacts",        
  "accounting.settings.read" 
];

function buildAuthorizationUrl(options = {}) {
  const { clientId, redirectUri, state, scopes = DEFAULT_SCOPES } = options;

  if (!validation.isNonEmptyString(clientId)) {
    throw new Error("Missing Xero client ID.");
  }
  if (!validation.isValidUrl(redirectUri)) {
    throw new Error("Invalid redirect URI.");
  }
  if (!validation.isNonEmptyString(state)) {
    throw new Error("Missing OAuth state.");
  }

  const verifier  = auth.generateCodeVerifier();
  const challenge = auth.generateCodeChallenge(verifier);

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
    authorizationUrl: `${AUTHORIZE_URL}?${params.toString()}`,
    codeVerifier: verifier
  };
}

async function exchangeCode(options = {}) {
  const { clientId, clientSecret, redirectUri, code, codeVerifier, timeout, retries } = options;

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
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return response.data;
}

async function refreshToken(options = {}) {
  const { clientId, clientSecret, refreshToken, timeout, retries } = options;

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
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return response.data;
}

async function revokeToken(options = {}) {
  const { clientId, clientSecret, refreshToken, timeout, retries } = options;

  const response = await http.post(
    REVOKE_URL,
    new URLSearchParams({ token: refreshToken }).toString(),
    {
      timeout,
      retries,
      headers: {
        ...auth.basic(clientId, clientSecret),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );
  return response.data;
}

/* ------------------------------------------------------------------ */
/* NEW: Xero does NOT return tenantId in the token response.          */
/* You must fetch it from the Connections API.                        */
/* ------------------------------------------------------------------ */
async function getTenantId(accessToken) {
  const response = await http.get(
    "https://api.xero.com/connections",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    }
  );

  if (Array.isArray(response.data) && response.data.length > 0) {
    // Return the first connected tenant.
    // If you need multi-tenant support later, return the array instead.
    return response.data[0].tenantId;
  }
  return null;
}

module.exports = Object.freeze({
  DEFAULT_SCOPES,
  buildAuthorizationUrl,
  exchangeCode,
  refreshToken,
  revokeToken,
  getTenantId
});