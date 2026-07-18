/**
 * ------------------------------------------------------------------------
 * Precifio Integration Engine
 * ------------------------------------------------------------------------
 * File:
 *   netlify/functions/integrations/auth.js
 *
 * Purpose:
 *   Generic OAuth helpers and integration connection storage.
 *
 * This module NEVER contains provider-specific logic.
 * ------------------------------------------------------------------------
 */

"use strict";

const crypto = require("crypto");

const {
  supabaseAdmin
} = require("../../../config/supabase.server");

const {
  encrypt,
  decrypt
} = require("./crypto");

const {
  OAUTH_STATE_EXPIRY_MS
} = require("./constants");

/**
 * Generate a secure random OAuth state.
 */
function generateState() {

  return crypto.randomUUID();

}

/**
 * Build a state record.
 */
function createState() {

  return {

    value: generateState(),

    expiresAt:
      Date.now() + OAUTH_STATE_EXPIRY_MS

  };

}

/**
 * Verify OAuth state.
 */
function verifyState(expected, received, expiresAt) {

  if (!expected || !received) {
    return false;
  }

  if (expected !== received) {
    return false;
  }

  if (Date.now() > expiresAt) {
    return false;
  }

  return true;

}

/**
 * PKCE verifier.
 */
function generateCodeVerifier() {

  return crypto
    .randomBytes(64)
    .toString("base64url");

}

/**
 * PKCE challenge.
 */
function generateCodeChallenge(verifier) {

  return crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

}

/**
 * Bearer header.
 */
function bearer(token) {

  return {

    Authorization: `Bearer ${token}`

  };

}

/**
 * Basic auth header.
 */
function basic(clientId, clientSecret) {

  const credentials = Buffer
    .from(
      `${clientId}:${clientSecret}`
    )
    .toString("base64");

  return {

    Authorization:
      `Basic ${credentials}`

  };

}

/**
 * Calculate expiry timestamp.
 */
function calculateExpiry(expiresInSeconds) {

  return Date.now() +

    expiresInSeconds * 1000;

}

/**
 * Check expiry.
 */
function isExpired(expiresAt) {

  return Date.now() >= expiresAt;

}

/**
 * Exchange authorization code.
 */
async function exchangeAuthorizationCode(options = {}) {

  const {

    http,

    tokenUrl,

    clientId,

    clientSecret,

    redirectUri,

    code,

    codeVerifier,

    timeout,

    retries

  } = options;

  const response = await http.post(

    tokenUrl,

    new URLSearchParams({

      grant_type:
        "authorization_code",

      code,

      redirect_uri:
        redirectUri,

      code_verifier:
        codeVerifier

    }).toString(),

    {

      timeout,

      retries,

      headers: {

        ...basic(
          clientId,
          clientSecret
        ),

        "Content-Type":
          "application/x-www-form-urlencoded",

        Accept:
          "application/json"

      }

    }

  );

  return response.data;

}

/**
 * Refresh token.
 */
async function refreshOAuthToken(options = {}) {

  const {

    http,

    tokenUrl,

    clientId,

    clientSecret,

    refreshToken,

    timeout,

    retries

  } = options;

  const response = await http.post(

    tokenUrl,

    new URLSearchParams({

      grant_type:
        "refresh_token",

      refresh_token:
        refreshToken

    }).toString(),

    {

      timeout,

      retries,

      headers: {

        ...basic(
          clientId,
          clientSecret
        ),

        "Content-Type":
          "application/x-www-form-urlencoded",

        Accept:
          "application/json"

      }

    }

  );

  return response.data;

}


/* ------------------------------------------------------------------ */
/* OAuth State Storage */
/* ------------------------------------------------------------------ */


/**
 * Save temporary OAuth state.
 */
async function saveOAuthState({

  state,

  userId,

  provider,

  codeVerifier,

  expiresAt

}) {


  const {
    data,
    error
  } = await supabaseAdmin

    .from("integration_oauth_states")

    .insert({

      state,

      user_id: userId,

      provider,

      code_verifier: codeVerifier,

      expires_at: expiresAt

    })

    .select()

    .single();



  if (error) {

    throw error;

  }


  return data;

}



/**
 * Retrieve OAuth state and remove it.
 *
 * OAuth states are one-time use.
 */
async function consumeOAuthState(state) {


  const {
    data,
    error
  } = await supabaseAdmin

    .from("integration_oauth_states")

    .select("*")

    .eq("state", state)

    .maybeSingle();



  if (error) {

    throw error;

  }



  if (!data) {

    return null;

  }



  await supabaseAdmin

    .from("integration_oauth_states")

    .delete()

    .eq("state", state);



  return data;

}

/* ------------------------------------------------------------------ */
/* Integration Connection Storage */
/* ------------------------------------------------------------------ */

/**
 * Save or update an integration.
 */
async function saveIntegrationConnection({

  userId,

  provider,

  accessToken,

  refreshToken,

  expiresAt,

  accountId,

  workspaceId,

  metadata = {},

  status = "connected"

}) {

  const { data, error } =

    await supabaseAdmin

      .from("user_integrations")

      .upsert({

        user_id: userId,

        provider,

        status,

        encrypted_access_token:
          encrypt(accessToken),

        encrypted_refresh_token:
          encrypt(refreshToken),

        token_expires_at:
          expiresAt,

        provider_account_id:
          accountId,

        provider_workspace_id:
          workspaceId,

        metadata

      })

      .select()

      .single();

  if (error) {

    throw error;

  }

  return data;

}

/**
 * Retrieve integration.
 */
async function getIntegrationConnection(

  userId,

  provider

) {

  const {

    data,

    error

  } = await supabaseAdmin

    .from("user_integrations")

    .select("*")

    .eq("user_id", userId)

    .eq("provider", provider)

    .maybeSingle();

  if (error) {

    throw error;

  }

  if (!data) {

    return null;

  }

  return {

    ...data,

    access_token:
      decrypt(
        data.encrypted_access_token
      ),

    refresh_token:
      decrypt(
        data.encrypted_refresh_token
      )

  };

}

/**
 * Update OAuth tokens.
 */
async function updateIntegrationTokens({

  userId,

  provider,

  accessToken,

  refreshToken,

  expiresAt

}) {

  const {

    data,

    error

  } = await supabaseAdmin

    .from("user_integrations")

    .update({

      encrypted_access_token:
        encrypt(accessToken),

      encrypted_refresh_token:
        encrypt(refreshToken),

      token_expires_at:
        expiresAt,

      status:
        "connected"

    })

    .eq("user_id", userId)

    .eq("provider", provider)

    .select()

    .single();

  if (error) {

    throw error;

  }

  return data;

}

/**
 * Disconnect integration.
 */
async function removeIntegrationConnection(

  userId,

  provider

) {

  const { error } =

    await supabaseAdmin

      .from("user_integrations")

      .delete()

      .eq("user_id", userId)

      .eq("provider", provider);

  if (error) {

    throw error;

  }

}

/**
 * Mark integration status.
 */
async function updateIntegrationStatus({

  userId,

  provider,

  status

}) {

  const {

    data,

    error

  } = await supabaseAdmin

    .from("user_integrations")

    .update({

      status

    })

    .eq("user_id", userId)

    .eq("provider", provider)

    .select()

    .single();

  if (error) {

    throw error;

  }

  return data;

}


/* ------------------------------------------------------------------ */
/* OAuth State Storage                                                */
/* ------------------------------------------------------------------ */

async function saveOAuthState({

  state,

  userId,

  provider,

  codeVerifier,

  expiresAt

}) {

  const { data, error } =

    await supabaseAdmin

      .from("integration_oauth_states")

      .insert({

        state,

        user_id: userId,

        provider,

        code_verifier: codeVerifier,

        expires_at: expiresAt

      })

      .select()

      .single();


  if (error) {

    throw error;

  }


  return data;

}



async function getOAuthState(state) {

  const {

    data,

    error

  } = await supabaseAdmin

    .from("integration_oauth_states")

    .select("*")

    .eq("state", state)

    .maybeSingle();


  if (error) {

    throw error;

  }


  return data;

}



async function deleteOAuthState(state) {

  const { error } =

    await supabaseAdmin

      .from("integration_oauth_states")

      .delete()

      .eq("state", state);


  if (error) {

    throw error;

  }

}


module.exports = Object.freeze({

createState,

  verifyState,

  saveOAuthState,

  getOAuthState,

  deleteOAuthState,

  consumeOAuthState,

  generateCodeVerifier,

  generateCodeChallenge,

  bearer,

  basic,

  calculateExpiry,

  isExpired,

  exchangeAuthorizationCode,

  refreshOAuthToken,

  saveIntegrationConnection,

  getIntegrationConnection,

  updateIntegrationTokens,

  removeIntegrationConnection,

  updateIntegrationStatus

});