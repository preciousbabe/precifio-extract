"use strict";

const registry   = require("./integrations/registry");
const auth       = require("./integrations/auth");
const responses  = require("./integrations/responses");
const logger     = require("./integrations/logger");
const exporter   = require("./integrations/export");
const engine     = require("./integrations/engine");

exports.handler = async (event) => {
  console.log("CALLBACK FUNCTION HIT");

  if (event.httpMethod !== "GET") {
    return responses.badRequest("Only GET requests are supported.");
  }

  try {
    /* ----------------------------------------------------------------
     * FIX: QuickBooks sends realmId in the callback query string.
     * ---------------------------------------------------------------- */
    const { code, state, realmId } = event.queryStringParameters || {};

    console.log(event.queryStringParameters);

    if (!code)  return responses.badRequest("Authorization code is required.");
    if (!state) return responses.badRequest("OAuth state is required.");

    const stateRecord = await auth.getOAuthState(state);
    console.log("STATE RECORD FROM DATABASE");
    console.log(stateRecord);

    if (!stateRecord) {
      return responses.unauthorized("OAuth state is invalid or has expired.");
    }

    const provider = stateRecord.provider;

    const valid = auth.verifyState(
      stateRecord.state,
      state,
      new Date(stateRecord.expires_at).getTime()
    );
    console.log("STATE VALID:", valid);
    if (!valid) {
      return responses.unauthorized("OAuth state verification failed.");
    }

    const integration = registry.getProvider(provider);
    console.log({ provider, integrationFound: !!integration, hasOAuth: !!integration.oauth });

    if (!integration)      return responses.notFound(`Unsupported provider: ${provider}`);
    if (!integration.oauth) return responses.badRequest(`${provider} does not support OAuth.`);

    console.log("EXCHANGING AUTHORIZATION CODE");
    console.log({ provider, hasCode: !!code, hasCodeVerifier: !!stateRecord.code_verifier });

    const tokens = await integration.oauth.exchangeCode({
      clientId:     process.env[integration.env.clientId],
      clientSecret: process.env[integration.env.clientSecret],
      redirectUri:  process.env[integration.env.redirectUri],
      code,
      codeVerifier: stateRecord.code_verifier
    });

    console.log("TOKEN RESPONSE");
    console.log({
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    /* ----------------------------------------------------------------
     * FIX: Resolve IDs from the correct sources.
     * auth.saveIntegrationConnection expects accountId / workspaceId.
     * It internally maps them to provider_account_id / provider_workspace_id.
     * ---------------------------------------------------------------- */
    let accountId   = null;
    let workspaceId = null;

    if (provider === "xero") {
      if (integration.oauth.getTenantId) {
        accountId = await integration.oauth.getTenantId(tokens.access_token);
        console.log("XERO TENANT ID RESOLVED:", accountId);
      }
    } else if (provider === "quickbooks") {
      workspaceId = realmId || null;
      console.log("QUICKBOOKS REALM ID FROM CALLBACK:", workspaceId);
    }

    console.log("SAVING CONNECTION");
    console.log({
      userId: stateRecord.user_id,
      provider,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      accountId,
      workspaceId
    });

    await auth.saveIntegrationConnection({
      userId:      stateRecord.user_id,
      provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:   new Date(auth.calculateExpiry(tokens.expires_in)),
      accountId,     // ← matches auth.js signature
      workspaceId,   // ← matches auth.js signature
      metadata:    tokens
    });

    console.log("USER INTEGRATION SAVED");
    console.log({ provider, userId: stateRecord.user_id });

    await auth.deleteOAuthState(state);
    console.log("TEMPORARY OAUTH STATE DELETED");

    logger.info("OAuth connection completed.", { provider, userId: stateRecord.user_id });

    const pending = stateRecord.pending_upload;
    console.log("PENDING UPLOAD");
    console.log(pending);

    /* ----------------------------------------------------------------
     * FIX: Never let a pending-upload failure crash the redirect.
     * ---------------------------------------------------------------- */
    if (pending) {
      try {
        const connection = await auth.getIntegrationConnection(
          stateRecord.user_id,
          provider
        );

        if (!connection) {
          logger.warn("Pending action skipped: no connection found.", {
            provider, userId: stateRecord.user_id
          });
        } else if (registry.supportsUpload(provider)) {
          const exported = await exporter.generateExport({
            model: pending.model,
            format: pending.exportFormat
          });
          const client = registry.getProviderClient(provider);
          await client.upload({
            connection,
            exportFile: exported,
            options: pending.options || {}
          });
        } else if (registry.supportsTransformation(provider)) {
          const transformed = await engine.transform({
            provider,
            model: pending.model,
            options: pending.options || {}
          });
          const client = registry.getProviderClient(provider);
          const sendOptions = {
            payload: transformed,
            accessToken: connection.access_token
          };
          if (provider === "xero") {
            sendOptions.tenantId = connection.provider_account_id;
          } else if (provider === "quickbooks") {
            sendOptions.realmId = connection.provider_workspace_id;
          }
          await client.send(sendOptions);
        }
      } catch (pendingError) {
        logger.error("Pending upload failed after OAuth callback.", {
          error: pendingError.message,
          stack: pendingError.stack,
          provider,
          userId: stateRecord.user_id
        });
        // Intentionally NOT re-throwing — user still needs to be redirected.
      }
    }

    const redirectUrl = process.env.OAUTH_REDIRECT_URL || "http://localhost:8888";
    return {
      statusCode: 302,
      headers: { Location: redirectUrl }
    };

  } catch (error) {
    logger.error("OAuth callback failed.", { error: error.message, stack: error.stack });
    return responses.serverError(error.message);
  }
};

