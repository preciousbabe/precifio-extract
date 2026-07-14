// src/utils/export-utils.js
// Export handlers — confidence stripped from all exports

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
 * Strip confidence from segments for clean export
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
 * Extract line items as array of objects (no confidence)
 */
function extractLineItems(segments) {
  const lineItemSeg = segments.find(s => /line|item|product|entry|detail/i.test(s.segment_name));
  if (!lineItemSeg) return [];
  return (lineItemSeg.fields || []).map(f => {
    const { _confidence, confidence, ...cleanValue } = f.value || {};
    return cleanValue;
  });
}

/**
 * Extract scalar fields from segments (no confidence)
 */
function extractScalarFields(segments) {
  const scalars = {};
  for (const seg of segments) {
    for (const field of seg.fields || []) {
      if (typeof field.value === "string" || typeof field.value === "number") {
        const key = field.label.toLowerCase().replace(/\s+/g, "_");
        scalars[key] = field.value;
      }
    }
  }
  return scalars;
}

// ─── JSON ─────────────────────────────────────────────────────────

export function exportAsJSON(payload) {
  const data = {
    fileName: payload.fileName,
    documentSummary: payload.documentSummary,
    extractedAt: new Date().toISOString(),
    segments: stripConfidence(payload.segments),
    metadata: payload.metadata
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.json`);
}

// ─── CSV ──────────────────────────────────────────────────────────

export function exportAsCSV(payload) {
  const lineItems = extractLineItems(payload.segments);
  let csv = "";

  if (lineItems.length > 0) {
    // Export line items as primary table — NO confidence column
    const headers = Object.keys(lineItems[0]);
    csv += headers.map(h => `"${h}"`).join(",") + "\n";
    for (const row of lineItems) {
      const vals = headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '""';
        const str = String(v).replace(/"/g, '""');
        return `"${str}"`;
      });
      csv += vals.join(",") + "\n";
    }
  } else {
    // Fallback: export all fields as flat CSV — NO confidence
    const flat = {};
    for (const seg of payload.segments || []) {
      const segName = seg.segment_name || "unknown";
      if (!flat[segName]) flat[segName] = {};
      for (const field of seg.fields || []) {
        flat[segName][field.label] = field.value;
      }
    }
    for (const [segName, fields] of Object.entries(flat)) {
      csv += '"Segment","Field","Value"\n';
      for (const [label, value] of Object.entries(fields)) {
        const v = String(value).replace(/"/g, '""');
        csv += `"${segName}","${label}","${v}"\n`;
      }
      csv += "\n";
    }
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.csv`);
}

// ─── Excel (.xlsx) ───────────────────────────────────────────────

export function exportAsExcel(payload) {
  const lineItems = extractLineItems(payload.segments);

  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>td,th{border:1px solid #ccc;padding:6px;font-family:Arial;font-size:12px}th{background:#f0f0f0;font-weight:bold}</style></head>
<body><table>`;

  html += `<tr><th colspan="10" style="font-size:14px;background:#1e40af;color:white">${escapeHtml(payload.fileName)} — Extraction Results</th></tr>`;
  html += `<tr><td colspan="10" style="background:#f9fafb">${escapeHtml(payload.documentSummary || "")} | Extracted: ${new Date().toLocaleString()}</td></tr>`;
  html += `<tr><td colspan="10"></td></tr>`;

  if (lineItems.length > 0) {
    const headers = Object.keys(lineItems[0]);
    html += `<tr>` + headers.map(h => `<th>${escapeHtml(h)}</th>`).join("") + `</tr>`;
    for (const row of lineItems) {
      html += `<tr>` + headers.map(h => `<td>${escapeHtml(String(row[h] || ""))}</td>`).join("") + `</tr>`;
    }
  } else {
    html += `<tr><th>Segment</th><th>Field</th><th>Value</th></tr>`;
    for (const seg of stripConfidence(payload.segments || [])) {
      for (const field of seg.fields || []) {
        const val = typeof field.value === "object" ? JSON.stringify(field.value) : String(field.value);
        html += `<tr><td>${escapeHtml(seg.segment_name)}</td><td>${escapeHtml(field.label)}</td><td>${escapeHtml(val)}</td></tr>`;
      }
    }
  }

  html += `</table></body></html>`;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_extracted.xls`);
}

// ─── PDF ──────────────────────────────────────────────────────────

export async function exportAsPDF(payload) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate PDF");
    return;
  }

  const html = generatePDFHTML(payload);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}

function generatePDFHTML(payload) {
  const segments = stripConfidence(payload.segments || []);
  let body = "";

  for (const seg of segments) {
    body += `<h2>${escapeHtml(seg.segment_name)}</h2>`;
    const isTable = seg.fields?.length > 1 && seg.fields.every(f => f.value && typeof f.value === "object" && !Array.isArray(f.value));

    if (isTable) {
      const cols = Object.keys(seg.fields[0].value);
      body += `<table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px">`;
      body += `<thead style="background:#f3f4f6"><tr>` + cols.map(c => `<th style="text-align:left;text-transform:capitalize">${escapeHtml(c)}</th>`).join("") + `</tr></thead>`;
      body += `<tbody>`;
      for (const f of seg.fields) {
        body += `<tr>` + cols.map(c => `<td>${escapeHtml(String(f.value[c] || ""))}</td>`).join("") + `</tr>`;
      }
      body += `</tbody></table>`;
    } else {
      body += `<table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px">`;
      for (const f of seg.fields || []) {
        body += `<tr><td style="width:30%;background:#f9fafb;font-weight:600">${escapeHtml(f.label)}</td><td>${escapeHtml(String(f.value))}</td></tr>`;
      }
      body += `</table>`;
    }
    body += `<br/>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><title>${escapeHtml(payload.fileName)} — Extraction</title></head>
    <body style="font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto">
      <h1>${escapeHtml(payload.fileName)}</h1>
      <p style="color:#6b7280">${escapeHtml(payload.documentSummary || "")}</p>
      <p style="color:#9ca3af;font-size:12px">Extracted on ${new Date().toLocaleString()}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
      ${body}
      <script>window.onload = () => { setTimeout(() => window.print(), 300); }</script>
    </body>
    </html>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Xero ─────────────────────────────────────────────────────────

export function exportAsXero(payload) {
  const lineItems = extractLineItems(payload.segments);
  const scalars = extractScalarFields(payload.segments);

  const xeroInvoice = {
    Type: "ACCPAY",
    Contact: {
      Name: scalars.company_name || scalars.vendor_name || scalars.supplier_name || "Unknown Vendor",
      EmailAddress: scalars.email || "",
      TaxNumber: scalars.tax_id || scalars.vat_number || ""
    },
    Date: formatDateForXero(scalars.invoice_date || scalars.date),
    DueDate: formatDateForXero(scalars.due_date),
    InvoiceNumber: scalars.invoice_number || scalars.bill_number || "",
    Reference: scalars.po_number || scalars.reference || "",
    CurrencyCode: extractCurrencyCode(scalars.currency),
    Status: "DRAFT",
    LineAmountTypes: "Inclusive",
    LineItems: lineItems.map((item, idx) => ({
      Description: item.description || item.item || "",
      Quantity: parseFloat(item.qty || item.quantity || 1),
      UnitAmount: parseMoney(item.unit_price),
      TaxType: mapTaxType(item.tax),
      AccountCode: item.account_code || item.gl_code || "200",
      LineItemID: item.sku || item.line_number || `line-${idx + 1}`
    })),
    SubTotal: parseMoney(scalars.subtotal),
    TotalTax: parseMoney(scalars.tax),
    Total: parseMoney(scalars.amount_due || scalars.total)
  };

  const blob = new Blob([JSON.stringify(xeroInvoice, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_xero.json`);
}

// ─── QuickBooks ────────────────────────────────────────────────────

export function exportAsQuickBooks(payload) {
  const lineItems = extractLineItems(payload.segments);
  const scalars = extractScalarFields(payload.segments);

  const qbInvoice = {
    TxnDate: formatDateForXero(scalars.invoice_date || scalars.date),
    DueDate: formatDateForXero(scalars.due_date),
    DocNumber: scalars.invoice_number || scalars.bill_number || "",
    PrivateNote: payload.documentSummary || "",
    CustomerRef: {
      value: scalars.company_name || scalars.customer_name || "Unknown",
      name: scalars.company_name || scalars.customer_name || "Unknown"
    },
    VendorRef: {
      value: scalars.vendor_name || scalars.supplier_name || scalars.company_name || "Unknown",
      name: scalars.vendor_name || scalars.supplier_name || scalars.company_name || "Unknown"
    },
    CurrencyRef: { value: extractCurrencyCode(scalars.currency) },
    Line: lineItems.map((item, idx) => ({
      DetailType: "SalesItemLineDetail",
      Amount: parseMoney(item.total),
      Description: item.description || item.item || "",
      SalesItemLineDetail: {
        Qty: parseFloat(item.qty || item.quantity || 1),
        UnitPrice: parseMoney(item.unit_price),
        TaxCodeRef: { value: mapTaxType(item.tax) }
      },
      LineNum: idx + 1
    })),
    TotalAmt: parseMoney(scalars.amount_due || scalars.total),
    Balance: parseMoney(scalars.balance_due || scalars.amount_due || scalars.total),
    CustomField: [
      { DefinitionId: "1", Name: "Extracted By", Type: "StringType", StringValue: "Precifio Extract" },
      { DefinitionId: "2", Name: "PO Number", Type: "StringType", StringValue: scalars.po_number || "" }
    ]
  };

  const blob = new Blob([JSON.stringify(qbInvoice, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${payload.fileName.replace(/\.[^.]+$/, "")}_quickbooks.json`);
}

// ─── Webhook ──────────────────────────────────────────────────────

export async function sendToWebhook(payload, options = {}) {
  const webhookUrl = process.env.REACT_APP_WEBHOOK_URL || localStorage.getItem("precifio_webhook_url");

  if (!webhookUrl) {
    const url = prompt("Enter your webhook URL:");
    if (!url) return;
    localStorage.setItem("precifio_webhook_url", url);
  }

  const finalUrl = webhookUrl || localStorage.getItem("precifio_webhook_url");

  const body = {
    event: options.type === "slack" ? "extraction.slack" : "extraction.completed",
    timestamp: new Date().toISOString(),
    payload: {
      fileName: payload.fileName,
      documentSummary: payload.documentSummary,
      segments: stripConfidence(payload.segments),
      metadata: payload.metadata
    }
  };

  try {
    const res = await fetch(finalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    alert(options.type === "slack" ? "Sent to Slack/Teams!" : "Webhook delivered successfully!");
  } catch (err) {
    console.error("Webhook failed:", err);
    alert(`Webhook failed: ${err.message}`);
  }
}

// ─── Email ────────────────────────────────────────────────────────

export async function sendEmail(payload) {
  const email = prompt("Enter recipient email address:");
  if (!email) return;

  const subject = encodeURIComponent(`Document Extraction: ${payload.fileName}`);
  const body = encodeURIComponent(
    `Document extraction results for: ${payload.fileName}\n\n` +
    `Summary: ${payload.documentSummary || "N/A"}\n\n` +
    `Extracted at: ${new Date().toLocaleString()}\n\n` +
    `---\n\n` +
    JSON.stringify(stripConfidence(payload.segments), null, 2)
  );

  try {
    const apiUrl = process.env.REACT_APP_API_URL || "";
    if (apiUrl) {
      const res = await fetch(`${apiUrl}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, payload: { ...payload, segments: stripConfidence(payload.segments) } })
      });
      if (res.ok) {
        alert("Email sent successfully!");
        return;
      }
    }
  } catch (e) {
    // Fallback to mailto
  }

  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

// ─── Clipboard ────────────────────────────────────────────────────

export async function copyToClipboard(payload) {
  const text = JSON.stringify({
    fileName: payload.fileName,
    documentSummary: payload.documentSummary,
    segments: stripConfidence(payload.segments)
  }, null, 2);

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

function formatDateForXero(dateStr) {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  const d = new Date(dateStr);
  if (!isNaN(d)) return d.toISOString().split("T")[0];
  return dateStr;
}

function extractCurrencyCode(currencyStr) {
  if (!currencyStr) return "USD";
  const match = String(currencyStr).match(/[A-Z]{3}/);
  return match ? match[0] : "USD";
}

function parseMoney(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function mapTaxType(taxStr) {
  if (!taxStr) return "NONE";
  const pct = parseFloat(String(taxStr).replace(/[^\d.]/g, ""));
  if (pct === 0) return "NONE";
  if (pct <= 5) return "TAX001";
  if (pct <= 10) return "TAX002";
  if (pct <= 20) return "TAX003";
  return "TAX001";
}