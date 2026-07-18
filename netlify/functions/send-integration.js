// netlify/functions/send-integration.js

"use strict";

const registry = require("./integrations/registry");
const engine = require("./integrations/engine");
const auth = require("./integrations/auth");
const responses = require("./integrations/responses");
const logger = require("./integrations/logger");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return responses.badRequest(
      "Only POST requests are supported."
    );
  }

  try {

    const body = JSON.parse(
      event.body || "{}"
    );

    const {

  provider,

  userId,

  model,

  exportFormat,

  url,

  options = {}

} = body;
    
    console.log(body);

    if (!provider) {

      return responses.badRequest(
        "Provider is required."
      );

    }

    const integration =
      registry.getProvider(provider);

    if (!integration) {

      return responses.notFound(
        `Unsupported provider: ${provider}`
      );

    }

    /*
     * --------------------------------------------------------
     * OAuth providers
     * --------------------------------------------------------
     */

    let connection = null;

    if (registry.supportsOAuth(provider)) {

      if (!userId) {

        return responses.badRequest(
          "User ID is required."
        );

      }

      connection =
        await auth.getIntegrationConnection(
          userId,
          provider
        );

      if (!connection) {

        return responses.unauthorized(
          `${provider} is not connected.`
        );

      }

      if (

        connection.token_expires_at &&

        auth.isExpired(
          new Date(
            connection.token_expires_at
          ).getTime()
        )

      ) {

        logger.info(
          "Refreshing OAuth token.",
          {
            provider,
            userId
          }
        );

        const oauth =
          registry.getOAuth(provider);

        const refreshed =
          await oauth.refreshToken({

            clientId:
              process.env[
                `${provider
                  .replace(/-/g, "_")
                  .toUpperCase()}_CLIENT_ID`
              ],

            clientSecret:
              process.env[
                `${provider
                  .replace(/-/g, "_")
                  .toUpperCase()}_CLIENT_SECRET`
              ],

            refreshToken:
              connection.refresh_token

          });

        await auth.updateIntegrationTokens({

          userId,

          provider,

          accessToken:
            refreshed.access_token,

          refreshToken:
            refreshed.refresh_token ||
            connection.refresh_token,

          expiresAt:
            new Date(
              auth.calculateExpiry(
                refreshed.expires_in
              )
            )

        });

        connection = {

          ...connection,

          access_token:
            refreshed.access_token,

          refresh_token:
            refreshed.refresh_token ||
            connection.refresh_token

        };

      }

    }

        /*
     * --------------------------------------------------------
     * AI Transformation Providers
     * --------------------------------------------------------
     */

    if (registry.supportsTransformation(provider)) {

      if (!model) {

        return responses.badRequest(
          "Export model is required."
        );

      }

      logger.info(
        "Transforming export model.",
        {
          provider
        }
      );

      const transformed =
        await engine.transform({

          provider,

          model,

          options

        });

      const client =
        registry.getProviderClient(provider);

      const result =
        await client.send({

          connection,

          payload: transformed,

          options

        });

      return responses.success({

        exported: true,

        provider,

        result

      });

    }

    /*
     * --------------------------------------------------------
     * Upload Providers
     * Google Drive
     * Dropbox
     * OneDrive
     * --------------------------------------------------------
     */

    if (registry.supportsUpload(provider)) {

      if (!model) {

        return responses.badRequest(
          "Export model is required."
        );

      }

      if (!exportFormat) {

        return responses.badRequest(
          "Export format is required."
        );

      }

      logger.info(
        "Preparing upload export.",
        {
          provider,
          exportFormat
        }
      );

      return responses.success({

        pending: true,

        provider,

        exportFormat,

        message:
          "Upload export pipeline initialized."

      });

}
        /*
     * --------------------------------------------------------
     * Direct Send Providers
     * Slack
     * Webhook
     * --------------------------------------------------------
     */

    if (registry.supportsSend(provider)) {

      if (!model) {

        return responses.badRequest(
          "Export model is required."
        );

      }

      const client =
        registry.getProviderClient(provider);

      const sendOptions = {

        payload: model,

        options

      };

      /*
       * Slack & generic webhooks also require
       * the destination URL supplied by the frontend.
       */

      if (url) {
        sendOptions.url = url;
      }

      /*
       * OAuth-backed send providers
       * (future-proof)
       */

      if (connection) {

        sendOptions.connection = connection;

        sendOptions.accessToken =
          connection.access_token;

      }

      const result =
        await client.send(sendOptions);

      return responses.success({

        exported: true,

        provider,

        result

      });

    }

    /*
     * --------------------------------------------------------
     * Provider exists but no supported capability
     * --------------------------------------------------------
     */

    return responses.badRequest(

      `Provider "${provider}" does not support this operation.`

    );

  }

  catch (error) {

    logger.error(

      "Integration failed.",

      {

        error: error.message,

        stack: error.stack

      }

    );

    return responses.serverError(

      error.message ||

      "Integration failed."

    );

  }

};