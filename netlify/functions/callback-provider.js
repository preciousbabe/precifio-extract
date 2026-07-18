"use strict";

const registry = require("./integrations/registry");
const auth = require("./integrations/auth");
const responses = require("./integrations/responses");
const logger = require("./integrations/logger");

exports.handler = async (event) => {

  if (event.httpMethod !== "GET") {
    return responses.badRequest("Only GET requests are supported.");
  }

  try {

    const {
      provider,
      code,
      state
    } = event.queryStringParameters || {};

    if (!provider) {
      return responses.badRequest("Provider is required.");
    }

    if (!code) {
      return responses.badRequest("Authorization code is required.");
    }

    if (!state) {
      return responses.badRequest("OAuth state is required.");
    }

    const integration = registry.get(provider);

    if (!integration) {
      return responses.notFound(
        `Unsupported provider: ${provider}`
      );
    }

    if (!integration.oauth) {
      return responses.badRequest(
        `${provider} does not support OAuth.`
      );
    }

    /*
     * Retrieve the temporary OAuth state.
     * Contains:
     *   userId
     *   codeVerifier
     *   expiresAt
     */
    const stateRecord =
      await integration.getOAuthState(state);

    if (!stateRecord) {
      return responses.unauthorized(
        "OAuth state is invalid or has expired."
      );
    }

    const valid =
      auth.verifyState(
        stateRecord.state,
        state,
        new Date(stateRecord.expires_at).getTime()
      );

    if (!valid) {
      return responses.unauthorized(
        "OAuth state verification failed."
      );
    }

    /*
     * Exchange authorization code.
     */

    const tokens =
      await integration.oauth.exchangeCode({

        clientId:
          process.env[integration.env.clientId],

        clientSecret:
          process.env[integration.env.clientSecret],

        redirectUri:
          process.env[integration.env.redirectUri],

        code,

        codeVerifier:
          stateRecord.code_verifier

      });

    /*
     * Persist encrypted tokens.
     */

    await auth.saveIntegrationConnection({

      userId:
        stateRecord.user_id,

      provider,

      accessToken:
        tokens.access_token,

      refreshToken:
        tokens.refresh_token,

      expiresAt:
        new Date(
          auth.calculateExpiry(
            tokens.expires_in
          )
        ),

      accountId:
        tokens.account_id ||

        tokens.tenantId ||

        null,

      workspaceId:
        tokens.realmId ||

        tokens.workspaceId ||

        null,

      metadata: tokens

    });

    /*
     * Cleanup temporary OAuth state.
     */

    await integration.deleteOAuthState(state);

    logger.info(
      "OAuth connection completed.",
      {
        provider,
        userId: stateRecord.user_id
      }
    );

    return responses.success({

      connected: true,

      provider

    });

  } catch (error) {

    logger.error(
      "OAuth callback failed.",
      {
        error: error.message
      }
    );

    return responses.serverError(
      error.message
    );

  }

};