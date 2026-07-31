// netlify/functions/send-integration.js

"use strict";

const registry = require("./integrations/registry");
const engine = require("./integrations/engine");
const auth = require("./integrations/auth");
const responses = require("./integrations/responses");
const logger = require("./integrations/logger");
const exporter = require("./integrations/export");
const uploader = require("./integrations/upload");

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
    
   console.log("================================");
console.log("SEND INTEGRATION REQUEST");
console.log("================================");

console.log({
  provider,
  userId,
  exportFormat,
  hasModel: !!model,
  hasOptions: !!options
});

    if (!provider) {

      return responses.badRequest(
        "Provider is required."
      );

    }

    const integration =
      registry.getProvider(provider);

      console.log("PROVIDER");

console.log({
  provider,
  exists: !!integration,
  supportsOAuth: registry.supportsOAuth(provider),
  supportsUpload: registry.supportsUpload(provider),
  supportsTransformation: registry.supportsTransformation(provider),
  supportsSend: registry.supportsSend(provider)
});

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

      console.log("LOOKING UP USER CONNECTION");

  console.log({
  provider,
  userId
  });

      connection =
        await auth.getIntegrationConnection(
          userId,
          provider
        );

        console.log("GOOGLE CONNECTION");
        console.log(connection);
    if (!connection) {

  console.log("NO STORED CONNECTION FOUND");

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

          console.log("REFRESHING ACCESS TOKEN");

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
        return responses.badRequest("Export model is required.");
      }

      logger.info("Transforming export model.", { provider });

      const transformed = await engine.transform({
        provider,
        model,
        options
      });

      logger.info("Sending transformed data to provider.", { provider });

      const client = registry.getProviderClient(provider);

      const sendOptions = {
        payload: transformed,
        accessToken: connection.access_token,
        timeout: options.timeout,
        retries: options.retries
      };

  
  if (provider === "xero") {
  if (!connection.provider_account_id) {
    throw new Error("Xero tenant ID is missing. Reconnect your Xero account.");
  }
  sendOptions.tenantId = connection.provider_account_id;
  } else if (provider === "quickbooks") {
  if (!connection.provider_workspace_id) {
    throw new Error("QuickBooks Realm ID is missing. Reconnect your QuickBooks account.");
  }
  sendOptions.realmId = connection.provider_workspace_id;
  }

      const result = await client.send(sendOptions);

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
  "Generating export.",
  {
    provider,
    exportFormat
  }
);

const exported =
  await exporter.generateExport({

    model,

    format: exportFormat

  });

  console.log("EXPORT GENERATED");

console.log({
  fileName: exported.fileName,
  extension: exported.extension,
  mimeType: exported.mimeType,
  size: exported.buffer.length
});


const client =
  registry.getProviderClient(provider);

  console.log("STARTING UPLOADER");

console.log({
  provider,
  fileName: exported.fileName,
  accessTokenExists: !!connection.access_token
});

const result =
  await client.upload({

    connection,

    exportFile: exported,

    options

});

  console.log("UPLOAD RESULT");

console.log(result);

return responses.success({

  exported: true,

  provider,

  format: exported.extension,

  result

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
        return responses.badRequest("Export model is required.");
      }

      const client = registry.getProviderClient(provider);

      const sendOptions = { url };

      if (provider === "slack") {
        sendOptions.text = `*Document Extraction: ${model.fileName || "Document"}*\n\`\`\`json\n${JSON.stringify(model, null, 2)}\n\`\`\``;
      } else {
        sendOptions.payload = model;
      }

      if (options && typeof options === "object") {
        Object.assign(sendOptions, options);
      }

      const result = await client.send(sendOptions);

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