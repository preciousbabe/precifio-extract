// src/utils/export-utils.js

const INTEGRATION_API = "/.netlify/functions";

// const DEFAULT_EMAIL_FORMAT = "pdf";

/**
 * Download a blob as a file.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

/**
 * Remove confidence values from exported data.
 */
function stripConfidence(segments = []) {
  return segments.map(segment => ({
    ...segment,

    fields: (segment.fields || []).map(field => {

      const { confidence, ...cleanField } = field;

      if (
        cleanField.value &&
        typeof cleanField.value === "object" &&
        !Array.isArray(cleanField.value)
      ) {

        const {
          confidence: nestedConfidence,
          ...cleanValue
        } = cleanField.value;

        return {
          ...cleanField,
          value: cleanValue
        };

      }

      return cleanField;

    })
  }));
}

/**
 * Determines if a segment represents a table.
 */
function isTableSegment(segment) {

  if (!segment) return false;

  if (
    segment.segment_type === "table"
  ) {
    return true;
  }

  const fields = segment.fields || [];

  if (fields.length < 2) {
    return false;
  }

  const first = fields[0]?.value;

  if (
    !first ||
    typeof first !== "object" ||
    Array.isArray(first)
  ) {
    return false;
  }

  const keys = Object.keys(first);

  return fields.every(field => {

    const value = field.value;

    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value)) === JSON.stringify(keys)
    );

  });

}

/**
 * Build clean export payload.
 */
export function buildExportModel(payload) {

  const segments = stripConfidence(
    payload.segments || []
  );

  const tables = [];
  const details = [];

  for (const segment of segments) {

    if (isTableSegment(segment)) {

      tables.push(segment);

    } else {

      details.push(segment);

    }

  }

  return {

    fileName: payload.fileName,

    documentSummary:
      payload.documentSummary,

    extractedAt:
      new Date().toISOString(),

    segments,

    tables,

    details

  };

}

/**
 * Download an export from the backend export engine.
 */
export async function downloadExport({

  payload,

  format

}) {

  const model =
    buildExportModel(payload);

  const response = await fetch(

    `${INTEGRATION_API}/generate-export`,

    {

      method: "POST",

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify({

        model,

        format

      })

    }

  );

  if (!response.ok) {

    let error = {};

    try {

      error = await response.json();

    } catch {}

    throw new Error(

      error.error ||

      "Failed to generate export."

    );

  }

  const blob =
    await response.blob();

  const disposition =
    response.headers.get(
      "Content-Disposition"
    );

  const baseName = (
    model.fileName || "document"
  ).replace(/\.[^/.]+$/, "");

  let filename =
    `${baseName}.${format}`;

  if (disposition) {

    const match =
      disposition.match(
        /filename="?(.+?)"?$/
      );

    if (match) {

      filename = match[1];

    }

  }

  downloadBlob(blob, filename);

  return {

    success: true,

    filename

  };

}

/**
 * Resolve user-configurable integration URLs.
 */
function resolveIntegrationUrl({
  envValue,
  storageKey,
  promptMessage
}) {

  let url =
    envValue ||
    localStorage.getItem(storageKey);

  if (!url) {

    const entered =
      prompt(promptMessage);

    if (!entered) {
      return null;
    }

    url = entered.trim();

    if (!/^https?:\/\//i.test(url)) {

      alert(
        "Invalid URL. URL must begin with http:// or https://"
      );

      return null;

    }

    localStorage.setItem(
      storageKey,
      url
    );

  }

  return url;

}

/**
 * Launch OAuth authorization flow.
 */
export async function connectIntegration({

  provider,

  userId,

  model,

  exportFormat,

  options = {}

}) {

  console.log("================================");
  console.log("CONNECT INTEGRATION CALLED");
  console.log("================================");
  console.log({ provider, userId });

  console.log("PENDING EXPORT");

console.log({
    provider,
    exportFormat,
    hasModel: !!model,
    options
});


  const response = await fetch(

    `${INTEGRATION_API}/connect-provider`,

    {

      method: "POST",

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify({

  provider,

  userId,

  model,

  exportFormat,

  options

})

    }

  );

  console.log("CONNECT STATUS");
  console.log(response.status);

  let result = {};

  try {

    result = await response.json();

  } catch (err) {

    console.error("FAILED TO PARSE JSON RESPONSE");
    console.error(err);

  }

  console.log("================================");
  console.log("CONNECT RESULT");
  console.log("================================");
  console.log(result);

  if (!response.ok) {

    throw new Error(

      result?.error ||

      result?.message ||

      "Failed to initialize OAuth."

    );

  }

  console.log("RESULT.DATA");
  console.log(result?.data);

  console.log("RESULT.AUTHORIZEURL");
  console.log(result?.authorizeUrl);

  const authorizeUrl =

    result?.data?.authorizeUrl ||

    result?.authorizeUrl ||

    null;

  console.log("FINAL AUTHORIZE URL");
  console.log(authorizeUrl);

  if (!authorizeUrl) {

    throw new Error(

      "Authorization URL missing."

    );

  }

  console.log("REDIRECTING TO GOOGLE...");

  window.location.href = authorizeUrl;

}

/**
 * Send export to an integration.
 */
export async function sendToIntegration({

  provider,

  payload,

  userId,

  exportFormat = "pdf",

  options = {}

}) {

  if (!provider) {

    throw new Error(

      "Integration provider is required."

    );

  }

  const model =
    buildExportModel(payload);

  let url = null;

  switch (provider) {

    case "slack":

      url = resolveIntegrationUrl({

        envValue:
          process.env.REACT_APP_SLACK_WEBHOOK_URL,

        storageKey:
          "precifio_slack_webhook_url",

        promptMessage:
          "Enter your Slack Incoming Webhook URL:"

      });

      if (!url) {
        return;
      }

      break;

    case "webhook":

      url = resolveIntegrationUrl({

        envValue:
          process.env.REACT_APP_WEBHOOK_URL,

        storageKey:
          "precifio_webhook_url",

        promptMessage:
          "Enter your Webhook URL:"

      });

      if (!url) {
        return;
      }

      break;

    case "google-drive":
    case "dropbox":
    case "onedrive":
    case "xero":
    case "quickbooks":

      // OAuth is handled by ExportDropdown.
      // We simply continue to send-integration.

      break;

    default:

      break;

  }

  const body = {

    provider,

    userId,

    model,

    exportFormat,

    options

  };

  if (url) {

    body.url = url;

  }

  const response = await fetch(

    `${INTEGRATION_API}/send-integration`,

    {

      method: "POST",

      headers: {

        "Content-Type": "application/json"

      },

      body: JSON.stringify(body)

    }

  );

  let result = {};

  try {

    result = await response.json();

  } catch {

    result = {};

  }

  if (!response.ok) {

    throw new Error(

      result.error ||

      `${provider} integration failed.`

    );

  }

  return result;

}


// ─── Email ────────────────────────────────────────────────────────

const DEFAULT_EMAIL_FORMAT = "pdf";

export async function sendEmail(

  payload,

  exportFormat = DEFAULT_EMAIL_FORMAT

) {

  const email = prompt(
    "Enter recipient email address:"
  );

  if (!email) {
    return;
  }

  const to = email.trim();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)
  ) {

    alert(
      "Please enter a valid email address."
    );

    return;

  }

  const model =
    buildExportModel(payload);

  const subject =
    `Document Extraction: ${model.fileName}`;

  const response = await fetch(

    `${INTEGRATION_API}/send-email`,

    {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json"

      },

      body: JSON.stringify({

        to,

        subject,

        model,

        exportFormat

      })

    }

  );

  let result = {};

  try {

    result =
      await response.json();

  } catch {

    result = {};

  }

  if (!response.ok) {

    throw new Error(

      result.error ||

      "Unable to send email."

    );

  }

  alert(
    `Email sent successfully as ${exportFormat.toUpperCase()}.`
  );

  return result;

}

// ─── Clipboard ────────────────────────────────────────────────────

export async function copyToClipboard(payload) {

  const text = JSON.stringify(

    buildExportModel(payload),

    null,

    2

  );

  try {

    await navigator.clipboard.writeText(
      text
    );

  } catch {

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value = text;

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand("copy");

    document.body.removeChild(
      textarea
    );

  }

}