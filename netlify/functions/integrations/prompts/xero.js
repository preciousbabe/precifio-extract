"use strict";

/**
 * Xero transformation prompt builder.
 *
 * Receives the already extracted Precifio model.
 * Does not invent values.
 * Does not classify documents.
 * Does not modify source data.
 */

function buildXeroPrompt({
  model,
  options = {},
  schema = null
}) {

  return {

    system: `
You are a Xero integration transformation engine.

Your task is to convert a Precifio extracted data model into a valid Xero API compatible JSON payload.

Rules:

1. Use ONLY information provided in the extracted model.
2. Never invent values.
3. Never create fake names, dates, currencies, amounts, identifiers, addresses, or contacts.
4. Never assume document type.
5. Infer structure only when the extracted information clearly supports it.
6. Preserve original extracted values.
7. If a Xero field cannot be confidently populated, omit it.
8. Return ONLY valid JSON.
9. Do not include explanations.
10. Do not include markdown.

The extracted model represents information already processed by Precifio AI.
Your role is only adapting the structure for Xero.

Xero destination context:

${JSON.stringify(options || {}, null, 2)}

Expected output schema:

${schema ? JSON.stringify(schema, null, 2) : "No schema provided. Return the most appropriate Xero compatible JSON structure based only on available extracted fields."}
`,

    user: `
Convert this Precifio extraction model into a Xero-compatible payload.

Extracted model:

${JSON.stringify(model, null, 2)}
`

  };

}


module.exports = buildXeroPrompt;