"use strict";

const ai = require("./ai");
const logger = require("./logger");
const registry = require("./registry");

/**
 * ------------------------------------------------------------------------
 * Precifio Integration Transformation Engine
 * ------------------------------------------------------------------------
 *
 * Responsibilities:
 *   • Validate provider
 *   • Load provider prompt from registry
 *   • Execute AI transformation
 *   • Return destination-ready payload
 *
 * Does NOT:
 *   • Store data
 *   • Send data
 *   • Perform OAuth
 *   • Inspect original files
 *   • Classify documents
 * ------------------------------------------------------------------------
 */

async function transform({
  provider,
  model,
  options = {}
}) {

  if (!provider) {
    throw new Error(
      "Integration provider is required."
    );
  }

  if (!model) {
    throw new Error(
      "Export model is required."
    );
  }

  const integration =
    registry.validate(provider);

  if (
    !registry.supportsTransformation(
      integration.id
    )
  ) {

    throw new Error(
      `${integration.displayName} does not support AI transformation.`
    );

  }

  const promptBuilder =
    registry.getPrompt(
      integration.id
    );

  if (!promptBuilder) {

    throw new Error(
      `No prompt registered for provider: ${integration.id}`
    );

  }

  const prompt = promptBuilder({

    model,

    options

  });

  const transformed =
    await ai.generateJSON({

      systemPrompt:
        prompt.system,

      userPrompt:
        prompt.user

    });

  if (
    !transformed ||
    typeof transformed !== "object" ||
    Array.isArray(transformed)
  ) {

    throw new Error(
      "AI transformation returned invalid payload."
    );

  }

  logger.info(
    "Integration transformation completed.",
    {
      provider: integration.id
    }
  );

  return transformed;

}

module.exports = Object.freeze({

  transform

});