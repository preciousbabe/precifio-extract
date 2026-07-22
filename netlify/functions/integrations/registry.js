"use strict";

/**
 * ------------------------------------------------------------------------
 * Precifio Integration Registry
 * ------------------------------------------------------------------------
 *
 * The registry is the single source of truth for every integration.
 *
 * Every provider registers:
 *   • OAuth implementation (optional)
 *   • Provider implementation (required)
 *   • AI transformation prompt (optional)
 *   • Capabilities
 *
 * Generic Netlify functions NEVER import providers directly.
 * They always resolve them through this registry.
 * * ------------------------------------------------------------------------
 */

const validation = require("./validation");

/* -------------------------------------------------------------------------- */
/* Provider Modules                                                           */
/* -------------------------------------------------------------------------- */

const providers = Object.freeze({

  xero: Object.freeze({
    id: "xero",
    displayName: "Xero",
    oauth: require("./oauth/xero"),
    provider: require("./providers/xero"),
    prompt: require("./prompts/xero"),

    env: Object.freeze({
    clientId: "XERO_CLIENT_ID",
    clientSecret: "XERO_CLIENT_SECRET",
    redirectUri: "XERO_REDIRECT_URI"
   }),

    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  }),

  quickbooks: Object.freeze({
    id: "quickbooks",
    displayName: "QuickBooks",
    oauth: require("./oauth/quickbooks"),
    provider: require("./providers/quickbooks"),
    prompt: require("./prompts/quickbooks"),

    env: Object.freeze({
    clientId: "QUICKBOOKS_CLIENT_ID",
    clientSecret: "QUICKBOOKS_CLIENT_SECRET",
    redirectUri: "QUICKBOOKS_REDIRECT_URI"
   }),

    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  }),

  slack: Object.freeze({
    id: "slack",
    displayName: "Slack",
    provider: require("./providers/slack"),
    capabilities: Object.freeze([
      "send"
    ])
  }),

  webhook: Object.freeze({
    id: "webhook",
    displayName: "Webhook",
    provider: require("./providers/webhook"),
    capabilities: Object.freeze([
      "send"
    ])
  }),

  "google-drive": Object.freeze({
  id: "google-drive",
  displayName: "Google Drive",

  oauth: require("./oauth/google-drive"),
  provider: require("./upload/google-drive"),

  env: Object.freeze({
    clientId: "GOOGLE_DRIVE_CLIENT_ID",
    clientSecret: "GOOGLE_DRIVE_CLIENT_SECRET",
    redirectUri: "GOOGLE_DRIVE_REDIRECT_URI"
  }),

  capabilities: Object.freeze([
    "oauth",
    "upload"
  ])
}),


  dropbox: Object.freeze({
    id: "dropbox",
    displayName: "Dropbox",
    oauth: require("./oauth/dropbox"),
    provider: require("./upload/dropbox"),

    env: Object.freeze({
    clientId: "DROPBOX_CLIENT_ID",
    clientSecret: "DROPBOX_CLIENT_SECRET",
    redirectUri: "DROPBOX_REDIRECT_URI"
}),

    capabilities: Object.freeze([
      "oauth",
      "upload"
    ])
  }),

  onedrive: Object.freeze({
    id: "onedrive",
    displayName: "OneDrive",
    oauth: require("./oauth/onedrive"),
    provider: require("./upload/onedrive"),

    env: Object.freeze({
    clientId: "ONEDRIVE_CLIENT_ID",
    clientSecret: "ONEDRIVE_CLIENT_SECRET",
    redirectUri: "ONEDRIVE_REDIRECT_URI"
   }),

    capabilities: Object.freeze([
      "oauth",
      "upload"
    ])
  }),

  
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getProvider(name) {

  const provider = providers[String(name || "").trim().toLowerCase()];

  if (!provider) {
    throw new Error(`Unsupported integration provider: ${name}`);
  }

  return provider;

}

function getOAuth(name) {
  return getProvider(name).oauth || null;
}

function getPrompt(name) {
  return getProvider(name).prompt || null;
}

function getProviderClient(name) {
  return getProvider(name).provider;
}

function supports(name, capability) {
  return getProvider(name).capabilities.includes(capability);
}

function supportsOAuth(name) {
  return supports(name, "oauth");
}

function supportsTransformation(name) {
  return supports(name, "transform");
}

function supportsUpload(name) {
  return supports(name, "upload");
}

function supportsSend(name) {
  return supports(name, "send");
}

function validate(name) {

  if (!validation.isSupportedProvider(name)) {
    throw new Error(`Unsupported integration provider: ${name}`);
  }

  return getProvider(name);

}

function listProviders() {
  return Object.values(providers);
}

module.exports = Object.freeze({

  validate,

  listProviders,

  getProvider,

  getOAuth,

  getPrompt,

  getProviderClient,

  supports,

  supportsOAuth,

  supportsTransformation,

  supportsUpload,

  supportsSend

});