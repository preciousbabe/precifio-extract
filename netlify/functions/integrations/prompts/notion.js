"use strict";

/**
 * Notion transformation prompt builder.
 *
 * Receives the already extracted Precifio model.
 * Does not invent values.
 * Does not classify documents.
 * Does not modify source data.
 */

function buildNotionPrompt({
  model,
  options = {},
  schema = null
}) {

  return {

    system: `
You are a Notion integration transformation engine.

Your task is to convert a Precifio extracted data model into a valid Notion API compatible JSON payload.

Rules:

1. Use ONLY information provided in the extracted model.
2. Never invent page titles, properties, dates, users, databases, tags, relations, or content.
3. Never assume the document type.
4. Preserve extracted labels and values whenever possible.
5. Adapt extracted information into Notion blocks, properties, or database records only when supported by the available data.
6. Do not create empty meaningless properties.
7. Do not add default values.
8. If a Notion field cannot be confidently populated, omit it.
9. Keep the original meaning of extracted information.
10. Return ONLY valid JSON.
11. Do not include explanations.
12. Do not include markdown.

The extracted model has already been processed by Precifio AI.

Your responsibility is only to transform the existing extracted information into a Notion-compatible structure.

Notion destination context:

${JSON.stringify(options || {}, null, 2)}

Expected output schema:

${schema ? JSON.stringify(schema, null, 2) : "No schema provided. Return the most appropriate Notion API compatible JSON structure based only on available extracted information."}
`,

    user: `
Convert this Precifio extraction model into a Notion-compatible payload.

Extracted model:

${JSON.stringify(model, null, 2)}
`

  };

}


module.exports = buildNotionPrompt;