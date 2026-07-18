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
    provider: require("./providers/google-drive"),
    capabilities: Object.freeze([
      "oauth",
      "upload"
    ])
  }),

  dropbox: Object.freeze({
    id: "dropbox",
    displayName: "Dropbox",
    oauth: require("./oauth/dropbox"),
    provider: require("./providers/dropbox"),
    capabilities: Object.freeze([
      "oauth",
      "upload"
    ])
  }),

  onedrive: Object.freeze({
    id: "onedrive",
    displayName: "OneDrive",
    oauth: require("./oauth/onedrive"),
    provider: require("./providers/onedrive"),
    capabilities: Object.freeze([
      "oauth",
      "upload"
    ])
  }),

  notion: Object.freeze({
    id: "notion",
    displayName: "Notion",
    oauth: require("./oauth/notion"),
    provider: require("./providers/notion"),
    prompt: require("./prompts/notion"),
    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  }),

  airtable: Object.freeze({
    id: "airtable",
    displayName: "Airtable",
    oauth: require("./oauth/airtable"),
    provider: require("./providers/airtable"),
    prompt: require("./prompts/airtable"),
    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  }),

  salesforce: Object.freeze({
    id: "salesforce",
    displayName: "Salesforce",
    oauth: require("./oauth/salesforce"),
    provider: require("./providers/salesforce"),
    prompt: require("./prompts/salesforce"),
    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  }),

  hubspot: Object.freeze({
    id: "hubspot",
    displayName: "HubSpot",
    oauth: require("./oauth/hubspot"),
    provider: require("./providers/hubspot"),
    prompt: require("./prompts/hubspot"),
    capabilities: Object.freeze([
      "oauth",
      "transform",
      "send"
    ])
  })

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