// netlify/functions/utils/ai-client.js
// OpenAI client for Precifio Extract.
// Uses the universal extraction prompt from prompts/universal-extraction.js

const OpenAI = require('openai');
const config = require('../../../config');
const systemPrompt = require('../../../prompts/universalExtractionPrompt');

console.log('Prompt type:', typeof systemPrompt);
console.log('Prompt preview:', systemPrompt.substring(0, 80));

class AIClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.ai.openai.apiKey
    });
  }

  async extract(text) {
  console.log("\n================ AI REQUEST ================");
  console.log("Model:", config.ai.openai.model);
  console.log("Input characters:", text.length);
  console.log(
    "Approx tokens:",
    Math.ceil(text.length / 4)
  );
  console.log(
    "Max tokens:",
    config.ai.openai.maxTokens
  );
  console.log("===========================================\n");

  try {
    const response =
      await this.client.chat.completions.create({
        model: config.ai.openai.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        max_tokens: config.ai.openai.maxTokens,
        temperature: config.ai.openai.temperature,
        response_format: {
          type: 'json_object'
        }
      });

    console.log("✅ OpenAI request succeeded");

        const data = this._parseResponse(response.choices[0].message.content);

    return {
      data,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0,
        model: config.ai.openai.model || "unknown",
      }
    };

  } catch (err) {

    console.error("\n========== OPENAI ERROR ==========");

    console.error("Message:", err.message);

    if (err.status)
      console.error("Status:", err.status);

    if (err.code)
      console.error("Code:", err.code);

    if (err.type)
      console.error("Type:", err.type);

    if (err.param)
      console.error("Param:", err.param);

    if (err.request_id)
      console.error("Request ID:", err.request_id);

    if (err.error)
      console.dir(err.error, { depth: null });

    console.error("Full Error:");
    console.dir(err, { depth: null });

    throw err;
  }
}

  _parseResponse(rawContent) {
    if (!rawContent) {
      throw new Error('AI returned an empty response.');
    }

    // Remove markdown code fences if present
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```/);

    const cleanContent = jsonMatch
      ? jsonMatch[1].trim()
      : rawContent.trim();

    let parsed;

    try {
      parsed = JSON.parse(cleanContent);
    } catch (err) {
      console.error('Failed to parse AI response:', err.message);
      console.error(
        'Raw AI response:',
        rawContent.substring(0, 1000)
      );

      throw new Error(
        `AI response parsing failed: ${err.message}`
      );
    }

    // Ensure expected structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('AI returned an invalid JSON object.');
    }

    if (!parsed.document_summary) {
      parsed.document_summary = '';
    }

    if (!Array.isArray(parsed.segments)) {
      parsed.segments = [];
    }

    parsed.segments = parsed.segments.map(segment => ({
      segment_name:
        segment.segment_name || 'Untitled Section',

      fields: Array.isArray(segment.fields)
  ? segment.fields.map(field => ({
      label: field.label || 'Unknown',
      value:
        field.value === undefined
          ? ''
          : field.value,
      confidence:
        typeof field.confidence === 'number'
          ? field.confidence
          : 0.5
    }))
  : []
    }));

    return parsed;
  }
}

module.exports = AIClient;