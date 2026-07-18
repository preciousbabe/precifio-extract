"use strict";

const registry = require("./integrations/registry");
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

    const body = JSON.parse(event.body || "{}");

    const {
      provider,
      userId
    } = body;

    if (!provider) {
      return responses.badRequest(
        "Provider is required."
      );
    }

    if (!userId) {
      return responses.badRequest(
        "User ID is required."
      );
    }

    const integration =
      registry.get(provider);

    if (!integration) {
      return responses.notFound(
        `Unsupported provider: ${provider}`
      );
    }

    const connection =
      await auth.getIntegrationConnection(
        userId,
        provider
      );

    if (!connection) {

      return responses.success({

        disconnected: true,

        provider

      });

    }

    /*
     * Revoke OAuth token if supported.
     */

    if (
      integration.oauth &&
      typeof integration.oauth.revokeToken === "function" &&
      connection.refresh_token
    ) {

      try {

        await integration.oauth.revokeToken({

          clientId:
            process.env[integration.env.clientId],

          clientSecret:
            process.env[integration.env.clientSecret],

          refreshToken:
            connection.refresh_token

        });

      } catch (error) {

        logger.warn(
          "Provider token revocation failed.",
          {
            provider,
            error: error.message
          }
        );

      }

    }

    await auth.removeIntegrationConnection(

      userId,

      provider

    );

    logger.info(
      "Integration disconnected.",
      {
        provider,
        userId
      }
    );

    return responses.success({

      disconnected: true,

      provider

    });

  }

  catch (error) {

    logger.error(
      "Disconnect failed.",
      {
        provider:
          JSON.parse(event.body || "{}").provider,
        error: error.message
      }
    );

    return responses.serverError(
      error.message
    );

  }

};