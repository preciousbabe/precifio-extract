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