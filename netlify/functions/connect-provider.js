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
  userId,
  model,
  exportFormat,
  options = {}
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

  console.log({
  provider,
  integrationFound: !!integration,
  hasOAuth: !!integration.oauth
   });

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

const state = auth.createState();

console.log("NEW OAUTH STATE CREATED");

console.log(state);


    /*
     * Build authorization URL
     */

    const result =
      oauth.buildAuthorizationUrl({

        clientId:
         process.env[integration.env.clientId],


        redirectUri:
         process.env[integration.env.redirectUri],

        state:
          state.value,


        scopes:
          oauth.DEFAULT_SCOPES

      });

      console.log("AUTHORIZATION URL GENERATED");

console.log({
  provider,
  hasCodeVerifier: !!result.codeVerifier
});

    /*
     * Save temporary OAuth session
     *
     * NOTE:
     * We will add this function to auth.js next.
     */

   console.log("PENDING EXPORT RECEIVED");

console.log({
    provider,
    exportFormat,
    hasModel: !!model
});

    await auth.saveOAuthState({

  state: state.value,

  userId,

  provider,

  codeVerifier: result.codeVerifier,

  expiresAt: new Date(state.expiresAt),

  pendingUpload: {

    model,

    exportFormat,

    options

  }

});

console.log("OAUTH STATE SAVED");

console.log({
  state: state.value,
  provider,
  userId
});


    logger.info(
      "OAuth connection initialized.",
      {
        provider,
        userId
      }
    );


console.log("AUTHORIZE URL:");
console.log(result.authorizationUrl);

return responses.success({
  provider,
  authorizeUrl: result.authorizationUrl
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