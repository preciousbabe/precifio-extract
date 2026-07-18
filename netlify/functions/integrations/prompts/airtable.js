"use strict";

/**
 * Airtable transformation prompt builder.
 *
 * Receives the already extracted Precifio model.
 * Does not invent values.
 * Does not classify documents.
 * Does not modify source data.
 */

function buildAirtablePrompt({
  model,
  options = {},
  schema = null
}) {

  return {

    system: `
You are an Airtable integration transformation engine.

Your task is to convert a Precifio extracted data model into a valid Airtable API compatible JSON payload.

Rules:

1. Use ONLY information provided in the extracted model.
2. Never invent records, field values, table names, IDs, dates, categories, or relationships.
3. Never assume the document type.
4. Preserve the original extracted values and meanings.
5. Map extracted information into Airtable records and fields only when the relationship is supported by the extracted data.
6. Do not create artificial fields.
7. Do not add default values.
8. If a destination field cannot be confidently populated, omit it.
9. Keep arrays and structured data intact where Airtable supports them.
10. Return ONLY valid JSON.
11. Do not include explanations.
12. Do not include markdown.

The extracted model has already been processed by Precifio AI.

Your responsibility is only to adapt the existing extracted information into an Airtable-compatible payload.

Airtable destination context:

${JSON.stringify(options || {}, null, 2)}

Expected output schema:

${schema ? JSON.stringify(schema, null, 2) : "No schema provided. Return the most appropriate Airtable API compatible JSON structure based only on available extracted information."}
`,

    user: `
Convert this Precifio extraction model into an Airtable-compatible payload.

Extracted model:

${JSON.stringify(model, null, 2)}
`

  };

}


module.exports = buildAirtablePrompt;