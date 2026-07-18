"use strict";

const OpenAI = require("openai");

const logger = require("./logger");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate structured JSON using GPT.
 */
async function generateJSON({
  systemPrompt,
  userPrompt,
  model = process.env.OPENAI_MODEL || "gpt-5",
  temperature = 0,
  maxOutputTokens = 12000
}) {

  if (!systemPrompt) {
    throw new Error("Missing system prompt.");
  }

  if (!userPrompt) {
    throw new Error("Missing user prompt.");
  }

  try {

    const response = await client.responses.create({

      model,

      temperature,

      max_output_tokens: maxOutputTokens,

      text: {
        format: {
          type: "json_object"
        }
      },

      input: [

        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },

        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userPrompt
            }
          ]
        }

      ]

    });

    const text = response.output_text || "{}";

    return JSON.parse(text);

  } catch (error) {

    logger.error("AI generation failed.", {
      error: error.message
    });

    throw error;

  }

}

module.exports = Object.freeze({

  generateJSON

});