// src/utils/export-utils.js

const INTEGRATION_API = "/.netlify/functions";

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
        const { confidence: nestedConfidence, ...cleanValue } = cleanField.value;
        return { ...cleanField, value: cleanValue };
      }
      return cleanField;
    })
  }));
}

function isTableSegment(segment) {
  if (!segment) return false;
  if (segment.segment_type === "table") return true;
  const fields = segment.fields || [];
  if (fields.length < 2) return false;

  const first = fields[0]?.value;
  if (!first || typeof first !== "object" || Array.isArray(first)) return false;

  const keys = JSON.stringify(Object.keys(first).sort());

  return fields.every(field => {
    const value = field?.value;
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value).sort()) === keys
    );
  });
}

export function buildExportModel(payload) {
  const segments = stripConfidence(payload.segments || []);
  const tables = [];
  const details = [];

  for (const segment of segments) {
    if (isTableSegment(segment)) tables.push(segment);
    else details.push(segment);
  }

  return {
    fileName: payload.fileName,
    documentSummary: payload.documentSummary,
    extractedAt: new Date().toISOString(),
    segments,
    tables,
    details
  };
}

/**
 * @param {Object} options
 * @param {Object} options.payload - raw extraction payload
 * @param {string} options.format - json | excel | pdf | docx
 * @param {Object} [options.config] - user/export configuration
 * @param {boolean} [options.returnBuffer] - return buffer instead of downloading
 */
export async function downloadExport({ payload, format, config = {}, returnBuffer = false }) {
  const model = buildExportModel(payload);

  const response = await fetch(
    `${INTEGRATION_API}/generate-export`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, format, config }) // <-- config added
    }
  );

  if (!response.ok) {
    let error = {};
    try { error = await response.json(); } catch {}
    throw new Error(error.error || "Failed to generate export.");
  }

  const blob = await response.blob();

   if (returnBuffer) {
    const arrayBuffer = await blob.arrayBuffer();
    return {
      buffer: new Uint8Array(arrayBuffer), 
      mimeType: blob.type,
      filename: `${(model.fileName || "document").replace(/\.[^/.]+$/, "")}.${format === "excel" ? "xlsx" : format}`
    };
  }


  const disposition = response.headers.get("Content-Disposition");
  const baseName = (model.fileName || "document").replace(/\.[^/.]+$/, "");
  let filename = `${baseName}.${format === "excel" ? "xlsx" : format}`;

  if (disposition) {
    const match = disposition.match(/filename="?(.+?)"?$/);
    if (match) filename = match[1];
  }

  downloadBlob(blob, filename);
  return { success: true, filename };
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
  if (!provider) throw new Error("Provider is required.");
  if (!userId) throw new Error("User ID is required.");

  const response = await fetch(`${INTEGRATION_API}/connect-provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, userId, model, exportFormat, options }),
  });

  let result = {};
  try {
    result = await response.json();
  } catch {
    // response body is not JSON; leave result empty
  }

  if (!response.ok) {
    throw new Error(result?.error || result?.message || "Failed to initialize OAuth.");
  }

  const authorizeUrl = result?.data?.authorizeUrl || result?.authorizeUrl;
  if (!authorizeUrl) {
    throw new Error("Authorization URL missing.");
  }

  window.location.href = authorizeUrl;
}


function resolveIntegrationUrl({ envValue, storageKey, promptMessage }) {
  const stored = localStorage.getItem(storageKey);
  if (stored) return stored;
  const input = window.prompt(promptMessage);
  if (!input || !input.trim()) return null;
  const trimmed = input.trim();
  try { new URL(trimmed); } catch {
    alert("Please enter a valid URL (including https://).");
    return null;
  }
  localStorage.setItem(storageKey, trimmed);
  return trimmed;
}


/**
 * Send export to an integration.
 * CHANGED: pulls `config` out of `options` and forwards it.
 */
export async function sendToIntegration({
  provider,
  payload,
  userId,
  exportFormat = "pdf",
  options = {}
}) {
  if (!provider) {
    throw new Error("Integration provider is required.");
  }

  const model = buildExportModel(payload);
  const config = options.config || {};

  let url = null;

  switch (provider) {
          case "slack":
        url = resolveIntegrationUrl({
        storageKey: "precifio_slack_webhook_url",
        promptMessage: "Enter your Slack Incoming Webhook URL:"
      });
      if (!url) throw new Error("Slack webhook URL is required.");
      break;

          case "webhook":
        url = resolveIntegrationUrl({
        storageKey: "precifio_webhook_url",
        promptMessage: "Enter your Webhook URL:"
      });
      if (!url) throw new Error("Webhook URL is required.");
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
    options: { ...options, config } // <-- config preserved
  };

  if (url) {
    body.url = url;
  }

  const response = await fetch(
    `${INTEGRATION_API}/send-integration`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  let result = {};
  try { result = await response.json(); } catch {}
    if (!response.ok) {
    throw new Error(result.error || `${provider} integration failed.`);
  }

  alert(
    provider === "slack"
      ? "Slack message sent successfully."
      : "Webhook delivered successfully."
  );

  return result;
}

const DEFAULT_EMAIL_FORMAT = "pdf";

export async function sendEmail(
  payload,
  exportFormat = DEFAULT_EMAIL_FORMAT,
  config = {}
) {
  const email = prompt("Enter recipient email address:");
  if (!email) return;

  const to = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    alert("Please enter a valid email address.");
    return;
  }

  const model = buildExportModel(payload);
  const subject = `Document Extraction: ${model.fileName}`;

  const response = await fetch(
    `${INTEGRATION_API}/send-email`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        model,
        exportFormat,
        config // <-- config added
      })
    }
  );

  let result = {};
  try { result = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(result.error || "Unable to send email.");
  }

  alert(`Email sent successfully as ${exportFormat.toUpperCase()}.`);
  return result;
}

export async function copyToClipboard(payload) {
  const text = JSON.stringify(buildExportModel(payload), null, 2);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}