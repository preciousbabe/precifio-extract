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


    const body =
      JSON.parse(event.body || "{}");


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
      registry.getProvider(provider);



    if (!integration) {

      return responses.notFound(
        `Unsupported provider: ${provider}`
      );

    }



    const oauth =
      integration.oauth;



    if (!oauth) {

      return responses.badRequest(
        `${provider} does not support OAuth.`
      );

    }



    /*
     * Create OAuth state
     */

    const state =
      auth.createState();



    /*
     * Build authorization URL
     */

    const result =
      oauth.buildAuthorizationUrl({

        clientId:
          process.env[
            `${provider.toUpperCase().replace("-", "_")}_CLIENT_ID`
          ],


        redirectUri:
          process.env[
            `${provider.toUpperCase().replace("-", "_")}_REDIRECT_URI`
          ],


        state:
          state.value,


        scopes:
          oauth.DEFAULT_SCOPES

      });



    /*
     * Save temporary OAuth session
     *
     * NOTE:
     * We will add this function to auth.js next.
     */

    await auth.saveOAuthState({

      state:
        state.value,

      userId,

      provider,

      codeVerifier:
        result.codeVerifier,

      expiresAt:
        new Date(state.expiresAt)

    });



    logger.info(
      "OAuth connection initialized.",
      {
        provider,
        userId
      }
    );



    return responses.success({

      provider,

      authorizeUrl:
        result.authorizationUrl

    });



  } catch(error) {


    logger.error(
      "OAuth connection initialization failed.",
      {
        error:error.message
      }
    );


    return responses.serverError(
      error.message
    );


  }


};