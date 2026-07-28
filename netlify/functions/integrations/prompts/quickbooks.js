"use strict";

/**
 * QuickBooks transformation prompt builder.
 *
 * Receives the already extracted Precifio model.
 * Does not invent values.
 * Does not classify documents.
 * Does not modify source data.
 */

function buildQuickBooksPrompt({
  model,
  options = {},
  schema = null
}) {

  return {

    system: `
You are a QuickBooks integration transformation engine.

Your task is to convert a Precifio extracted data model into a valid QuickBooks API compatible JSON payload.

Rules:

1. Use ONLY information provided in the extracted model.
2. Never invent values.
3. Never create fake customers, vendors, products, dates, currencies, amounts, IDs, addresses, or account information.
4. Never assume the document type.
5. Do not force the extracted information into a QuickBooks object if the data does not support it.
6. Preserve the original extracted values.
7. If a QuickBooks field cannot be confidently populated, omit it.
8. Do not add default values.
9. Do not rename extracted meanings incorrectly.
10. Return ONLY valid JSON.
11. Do not include explanations.
12. Do not include markdown.

The extracted model has already been processed by Precifio AI.

Your responsibility is only:
- interpret the available extracted information,
- adapt it into the appropriate QuickBooks structure,
- preserve the integrity of the original extraction.

QuickBooks destination context:

${JSON.stringify(options || {}, null, 2)}

Expected output schema:

${schema ? JSON.stringify(schema, null, 2) : JSON.stringify({ Line: [], CustomerRef: {} }, null, 2)}
`,

    user: `
Convert this Precifio extraction model into a QuickBooks-compatible payload.

Extracted model:

${JSON.stringify(model, null, 2)}
`

  };

}


module.exports = buildQuickBooksPrompt;