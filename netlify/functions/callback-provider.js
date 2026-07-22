"use strict";

const registry = require("./integrations/registry");
const auth = require("./integrations/auth");
const responses = require("./integrations/responses");
const logger = require("./integrations/logger");
const exporter = require("./integrations/export");

exports.handler = async (event) => {

  console.log("CALLBACK FUNCTION HIT");

  if (event.httpMethod !== "GET") {
    return responses.badRequest(
      "Only GET requests are supported."
    );
  }

  try {

    const {
      code,
      state
    } = event.queryStringParameters || {};

    console.log(event.queryStringParameters);

    /*
     * Validate required query parameters
     */

    if (!code) {
      return responses.badRequest(
        "Authorization code is required."
      );
    }

    if (!state) {
      return responses.badRequest(
        "OAuth state is required."
      );
    }

    /*
     * Retrieve temporary OAuth session
     */

    const stateRecord =
      await auth.getOAuthState(state);

      console.log("STATE RECORD FROM DATABASE");

console.log(stateRecord);

    if (!stateRecord) {

      return responses.unauthorized(
        "OAuth state is invalid or has expired."
      );

    }

    /*
     * Provider is stored in the OAuth state,
     * NOT passed through the URL.
     */

    const provider =
      stateRecord.provider;

    /*
     * Validate OAuth state
     */

    const valid =
      auth.verifyState(

        stateRecord.state,

        state,

        new Date(
          stateRecord.expires_at
        ).getTime()

      );

      console.log("STATE VALID:", valid);

    if (!valid) {

      return responses.unauthorized(
        "OAuth state verification failed."
      );

    }

    /*
     * Load integration
     */

    const integration =
      registry.getProvider(provider);

    console.log({

      provider,

      integrationFound:
        !!integration,

      hasOAuth:
        !!integration.oauth

    });

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
     * Exchange authorization code
     * for OAuth tokens.
     */

    console.log("EXCHANGING AUTHORIZATION CODE");

  console.log({
  provider,
  hasCode: !!code,
  hasCodeVerifier: !!stateRecord.code_verifier
  });

    const tokens =
      await integration.oauth.exchangeCode({

        clientId:
          process.env[
            integration.env.clientId
          ],

        clientSecret:
          process.env[
            integration.env.clientSecret
          ],

        redirectUri:
          process.env[
            integration.env.redirectUri
          ],

        code,

        codeVerifier:
          stateRecord.code_verifier

      });

      console.log("TOKEN RESPONSE");
     console.log("TOKEN RESPONSE");

console.log({
  hasAccessToken: !!tokens.access_token,
  hasRefreshToken: !!tokens.refresh_token,
  expiresIn: tokens.expires_in,
  accountId: tokens.account_id,
  tenantId: tokens.tenantId,
  realmId: tokens.realmId
});

    /*
     * Persist encrypted tokens.
     */
     
    console.log("SAVING CONNECTION");
console.log({
  userId: stateRecord.user_id,
  provider,
  hasAccessToken: !!tokens.access_token,
  hasRefreshToken: !!tokens.refresh_token
});

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

      metadata:
        tokens

    });
    console.log("USER INTEGRATION SAVED");

console.log({
  provider,
  userId: stateRecord.user_id
});

    /*
     * OAuth completed successfully.
     * Safe to remove temporary state.
     */

    await auth.deleteOAuthState(state);
     console.log("TEMPORARY OAUTH STATE DELETED");

    logger.info(

      "OAuth connection completed.",

      {

        provider,

        userId:
          stateRecord.user_id

      }

    );

    /*
     * Return user to the application.
     */

    const pending =
  stateRecord.pending_upload;

console.log("PENDING UPLOAD");

console.log(pending);

if (pending) {

  console.log("================================");
  console.log("STARTING PENDING GOOGLE UPLOAD");
  console.log("================================");

  const connection =
    await auth.getIntegrationConnection(
      stateRecord.user_id,
      provider
    );

  console.log("CONNECTION");
  console.log({
    exists: !!connection,
    hasToken: !!connection?.access_token
  });

  const exported =
    await exporter.generateExport({

      model: pending.model,

      format: pending.exportFormat

    });

  console.log("EXPORT CREATED");
  console.log({
    file: exported.fileName,
    format: exported.extension
  });

  const client =
    registry.getProviderClient(provider);

  const uploadResult =
    await client.upload({

      connection,

      exportFile: exported,

      options: pending.options || {}

    });

  console.log("UPLOAD COMPLETE");
  console.log(uploadResult);

}

return {

  statusCode: 302,

  headers: {

    Location:
      "http://localhost:8888"

  }

};
  }

  catch (error) {

    logger.error(

      "OAuth callback failed.",

      {

        error:
          error.message

      }

    );

    return responses.serverError(
      error.message
    );

  }

};