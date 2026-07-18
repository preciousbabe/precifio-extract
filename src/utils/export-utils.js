// src/utils/export-utils.js
// Export handlers — confidence AND internal metadata stripped from all exports
// Requires: npm install jspdf jspdf-autotable

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
const INTEGRATION_API = "/.netlify/functions";

/**
 * Download a blob as a file
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
 * Strip confidence from segments for model export
 */
function stripConfidence(segments) {
  return segments.map(seg => ({
    ...seg,
    fields: (seg.fields || []).map(f => {
      const { confidence, ...rest } = f;
      // Also strip confidence from nested object values
      if (rest.value && typeof rest.value === "object" && !Array.isArray(rest.value)) {
        const { confidence: _, ...cleanValue } = rest.value;
        return { ...rest, value: cleanValue };
      }
      return rest;
    })
  }));
}

/**
 * Build the model export payload used by every export/share channel.
 * Deliberately excludes internal metadata (extraction method, aiProvider,
 * creditsUsed, newBalance, etc.) — only user-facing data is exported.
 */
function buildExportModel(payload) {

  const segments = stripConfidence(payload.segments || []);

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
    documentSummary: payload.documentSummary,
    extractedAt: new Date().toISOString(),
    segments,
    tables,
    details
  };

}

function buildIntegrationExport(payload, format) {
  const model = buildExportModel(payload);

  return {
    format,
    generatedBy: "Precifio Extract",
    generatedAt: model.extractedAt,
    fileName: model.fileName,
    documentSummary: model.documentSummary,
    tables: model.tables,
    details: model.details
  };
}




function getTableHeaders(table) {
  if (!table?.fields?.length) {
    return [];
  }

  const firstRow = table.fields[0]?.value;

  if (!firstRow || typeof firstRow !== "object") {
    return [];
  }

  return Object.keys(firstRow);
}

function getTableRows(table) {
  return (table.fields || []).map(field => field.value || {});
}


/**
 * Returns true if a segment represents a table.
 */
function isTableSegment(segment) {
  const fields = segment?.fields || [];

  return (
    fields.length > 1 &&
    fields.every(field =>
      field &&
      field.value &&
      typeof field.value === "object" &&
      !Array.isArray(field.value)
    )
  );
}


/**
 * Returns all non-table segments.
 */
function getScalarSegments(segments) {
  return (segments || []).filter(seg => !isTableSegment(seg));
}

/**
 * Flatten all scalar segments.
 */
function getScalarFields(segments) {

  const rows = [];

  for (const seg of getScalarSegments(segments)) {

    for (const field of seg.fields || []) {

      rows.push({

        segment: seg.segment_name,

        label: field.label,

        value: field.value

      });

    }

  }

  return rows;

}

// ─── JSON ─────────────────────────────────────────────────────────

export function exportAsJSON(payload) {
  const data = buildExportModel(payload);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.json`);
}

// ─── CSV ──────────────────────────────────────────────────────────

export function exportAsCSV(payload) {
 const model = buildExportModel(payload);
 const tableSegments = model.tables;
 const scalarFields = getScalarFields(model.details);
  let csv = "";

  if (tableSegments.length) {
    for (const table of tableSegments) {

  csv += `"${table.segment_name}"\n`;

  const headers = getTableHeaders(table);

  csv += headers.map(h => `"${h}"`).join(",") + "\n";

  for (const row of getTableRows(table)) {

    csv += headers
      .map(col => {
        const v = row[col];

        if (v === null || v === undefined) {
          return `""`;
        }

        return `"${String(v).replace(/"/g,'""')}"`;

      })
      .join(",");

    csv += "\n";

  }

  csv += "\n";

}
  } else {
    if (scalarFields.length) {

  csv += `"Details"\n`;
  csv += `"Segment","Field","Value"\n`;

  for (const row of scalarFields) {

    csv += `"${row.segment}","${row.label}","${String(row.value).replace(/"/g,'""')}"\n`;

  }

}
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.csv`);
}

// ─── Excel (.xlsx) ───────────────────────────────────────────────

export function exportAsExcel(payload) {
 const model = buildExportModel(payload);
const tableSegments = model.tables;
const scalarFields = getScalarFields(model.details);

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:6px;font-family:Arial;font-size:12px}th{background:#f0f0f0;font-weight:bold}</style></head>
<body><table>`;

  html += `<tr><th colspan="10" style="font-size:14px;background:#1e40af;color:white">${escapeHtml(payload.fileName)} — Extraction Results</th></tr>`;
  html += `<tr><td colspan="10" style="background:#f9fafb">${escapeHtml(payload.documentSummary || "")} | Extracted: ${new Date().toLocaleString()}</td></tr>`;
  html += `<tr><td colspan="10"></td></tr>`;

  //
// Export every table exactly as GPT produced it
//

for (const table of tableSegments) {

  html += `
    <tr>
      <th colspan="20"
          style="
            background:#2563eb;
            color:white;
            font-size:13px;
            text-align:left;
            padding:8px;
          ">
        ${escapeHtml(table.segment_name)}
      </th>
    </tr>
  `;

 const headers = getTableHeaders(table);

html += "<tr>";

for (const header of headers) {
    html += `<th>${escapeHtml(header)}</th>`;
  }

  html += "</tr>";

  for (const row of getTableRows(table)) {

    html += "<tr>";

    for (const header of headers) {

      html += `<td>${
        escapeHtml(String(row[header] ?? ""))
      }</td>`;

    }

    html += "</tr>";

  }

  html += `<tr><td colspan="20"></td></tr>`;

}

if (scalarFields.length) {

  html += `
    <tr>
      <th colspan="3"
          style="
            background:#111827;
            color:white;
            text-align:left;
            padding:8px;
          ">
        Details
      </th>
    </tr>
  `;

  html += `
    <tr>
      <th>Segment</th>
      <th>Field</th>
      <th>Value</th>
    </tr>
  `;

  for (const row of scalarFields) {

    html += `
      <tr>
        <td>${escapeHtml(row.segment)}</td>
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(String(row.value))}</td>
      </tr>
    `;

  }

}

  html += `</table></body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.xls`);
}

// ─── PDF (real file download via jsPDF) ───────────────────────────

function formatPdfCell(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function exportAsPDF(payload) {

  const model = buildExportModel(payload);

  const doc = new jsPDF({
    unit: "pt",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  let y = margin;

  // Title

  doc.setFontSize(18);
  doc.setTextColor(0);

  doc.text(
    model.fileName || "Extraction",
    margin,
    y
  );

  y += 24;

  // Summary

  if (model.documentSummary) {

    doc.setFontSize(10);
    doc.setTextColor(110);

    const lines = doc.splitTextToSize(
      model.documentSummary,
      pageWidth - margin * 2
    );

    doc.text(lines, margin, y);

    y += lines.length * 13 + 8;

  }

  // Timestamp

  doc.setFontSize(9);
  doc.setTextColor(150);

  doc.text(
    `Extracted on ${new Date(model.extractedAt).toLocaleString()}`,
    margin,
    y
  );

  y += 22;

  doc.setTextColor(0);

  // Render every segment exactly as GPT produced it

  for (const segment of model.segments) {

    if (y > 700) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(13);

    doc.text(
      segment.segment_name || "Segment",
      margin,
      y
    );

    y += 8;

    if (isTableSegment(segment)) {

      const headers = getTableHeaders(segment);

      const rows = getTableRows(segment);

      autoTable(doc, {

        startY: y,

        head: [headers],

        body: rows.map(row =>
          headers.map(header =>
            formatPdfCell(row[header])
          )
        ),

        margin: {
          left: margin,
          right: margin
        },

        styles: {
          fontSize: 9,
          cellPadding: 6
        },

        headStyles: {
          fillColor: [243, 244, 246],
          textColor: 0,
          fontStyle: "bold"
        },

        pageBreak: "auto",
        rowPageBreak: "auto"

      });

    } else {

      autoTable(doc, {

        startY: y,

        body: (segment.fields || []).map(field => [

          field.label,

          formatPdfCell(field.value)

        ]),

        margin: {
          left: margin,
          right: margin
        },

        styles: {
          fontSize: 9,
          cellPadding: 6
        },

        columnStyles: {
          0: {
            cellWidth: 180,
            fontStyle: "bold"
          }
        },

        pageBreak: "auto",
        rowPageBreak: "auto"

      });

    }

    y = (doc.lastAutoTable?.finalY || y) + 24;

  }

  const base =
    (model.fileName || "document")
      .replace(/\.[^.]+$/, "");

  doc.save(`${base}_extracted.pdf`);

}


function resolveIntegrationUrl({
  envValue,
  storageKey,
  promptMessage
}) {

  let url =
    envValue ||
    localStorage.getItem(storageKey);

  if (!url) {

    const entered = prompt(promptMessage);

    if (!entered) {
      return null;
    }

    url = entered.trim();

    if (!/^https?:\/\//i.test(url)) {

      alert(
        "Invalid URL. It must begin with http:// or https://"
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

// generic ApI calls

export async function sendToIntegration({

  provider,

  payload,

  userId,

  exportFormat = null,

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


  switch(provider) {


    case "slack":

      url = resolveIntegrationUrl({

        envValue:
          process.env.REACT_APP_SLACK_WEBHOOK_URL,

        storageKey:
          "precifio_slack_webhook_url",

        promptMessage:
          "Enter your Slack Incoming Webhook URL:"

      });

      if (!url) return;

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

      if (!url) return;

      break;


    default:

      break;

  }


  const body = {

  provider,

  userId,

  model,

  exportFormat,

  url,

  options

};


  const res = await fetch(

    `${INTEGRATION_API}/send-integration`,

    {

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:
        JSON.stringify(body)

    }

  );


  const result =
    await res.json();



  if(!res.ok){

    throw new Error(

      result.error ||

      `${provider} integration failed.`

    );

  }


  return result;

}

// ─── Email ────────────────────────────────────────────────────────

export async function sendEmail(payload) {
  const email = prompt("Enter recipient email address:");
  if (!email) return;

  const to = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    alert("Please enter a valid email address.");
    return;
  }

  const model = buildExportModel(payload);
  const subject = `Document Extraction: ${model.fileName}`;

  try {
  const res = await fetch("/.netlify/functions/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      subject,
      payload: model
    })
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || "Unable to send email.");
  }

  alert("Email sent successfully!");
  return;

} catch (err) {
  console.error(err);
}


  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${model.fileName.replace(/\.[^.]+$/, "")}_extracted.json`);

  const mailSubject = encodeURIComponent(subject);
  const mailBody = encodeURIComponent(
    `Document extraction results for: ${model.fileName}\n\n` +
    `Summary: ${model.documentSummary || "N/A"}\n` +
    `Extracted at: ${new Date().toLocaleString()}\n\n` +
    `The full extraction JSON has been downloaded to your computer — please attach it to this email.`
  );

  window.location.href = `mailto:${to}?subject=${mailSubject}&body=${mailBody}`;
}

// ─── Clipboard ────────────────────────────────────────────────────

export async function copyToClipboard(payload) {
  const text = JSON.stringify(buildExportModel(payload), null, 2)

  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

