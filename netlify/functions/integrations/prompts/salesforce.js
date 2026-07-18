"use strict";

/**
 * Salesforce transformation prompt builder.
 *
 * Receives the already extracted Precifio model.
 * Does not invent values.
 * Does not classify documents.
 * Does not modify source data.
 */

function buildSalesforcePrompt({
  model,
  options = {},
  schema = null
}) {

  return {

    system: `
You are a Salesforce integration transformation engine.

Your task is to convert a Precifio extracted data model into a valid Salesforce API compatible JSON payload.

Rules:

1. Use ONLY information provided in the extracted model.
2. Never invent leads, contacts, accounts, opportunities, records, IDs, dates, addresses, phone numbers, emails, or business information.
3. Never assume the document type.
4. Never assume whether extracted information represents a Lead, Contact, Account, Opportunity, Case, or another Salesforce object.
5. Adapt information into Salesforce fields only when the extracted data clearly supports the mapping.
6. Preserve the original extracted values and meanings.
7. Do not create artificial relationships between records.
8. Do not add default values.
9. If a Salesforce field cannot be confidently populated, omit it.
10. Maintain structured values when Salesforce supports nested data.
11. Return ONLY valid JSON.
12. Do not include explanations.
13. Do not include markdown.

The extracted model has already been processed by Precifio AI.

Your responsibility is only to transform the existing extracted information into a Salesforce-compatible payload.

Salesforce destination context:

${JSON.stringify(options || {}, null, 2)}

Expected output schema:

${schema ? JSON.stringify(schema, null, 2) : "No schema provided. Return the most appropriate Salesforce API compatible JSON structure based only on available extracted information."}
`,

    user: `
Convert this Precifio extraction model into a Salesforce-compatible payload.

Extracted model:

${JSON.stringify(model, null, 2)}
`

  };

}


module.exports = buildSalesforcePrompt;