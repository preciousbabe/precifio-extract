// integrations/export/utils.js

"use strict";

function sanitizeFileName(name = "document") {
  return String(name)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_");
}

function buildFileName(name, extension) {
  const safeName = sanitizeFileName(name || "document");
  const ext = String(extension || "").replace(/^\./, "");
  return ext ? `${safeName}.${ext}` : safeName;
}

function stripBrokenBar(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/[¦|]/g, "")
    .replace(/₦/g, "N");
}

function formatLabel(key) {
  if (!key) return "";
  return stripBrokenBar(String(key))
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatFieldValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return stripBrokenBar(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(v => formatFieldValue(v)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `${formatLabel(k)}: ${formatFieldValue(v)}`)
      .join(" | ");
  }
  return stripBrokenBar(String(value));
}

function sanitizeValue(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  return Buffer.from(String(value), "utf8");
}

function isTableSegment(segment = {}) {
  const t = (segment.segment_type || "").toLowerCase();
  if (t === "detail") return false;
  if (t === "table") {
    const fields = segment.fields || [];
    return fields.length > 0 && fields.every(f => {
      const v = f?.value;
      return v && typeof v === "object" && !Array.isArray(v);
    });
  }

  const fields = segment.fields || [];
  if (fields.length < 1) return false;

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

function flattenSegments(segments = []) {
  const rows = [];
  for (const segment of segments) {
    const section = segment.segment_name || "General";
    for (const field of segment.fields || []) {
      rows.push({
        section,
        label: field.label || "",
        value: sanitizeValue(field.value),
        confidence: field.confidence ?? null
      });
    }
  }
  return rows;
}

function segmentsToRows(segments = []) {
  return flattenSegments(segments).map(row => ({
    Section: row.section,
    Field: row.label,
    Value: row.value,
    Confidence: row.confidence
  }));
}

function normalizeModel(model = {}) {
  return {
    fileName: model.fileName || "document",
    documentSummary: model.documentSummary || "",
    metadata: model.metadata || {},
    extractedAt: model.extractedAt || new Date().toISOString(),
    segments: Array.isArray(model.segments) ? model.segments : []
  };
}

function calculateColumnWidths(columns, fields, availableWidth) {
  const charWidth = 5.5;
  const padding = 14;
  const minWidth = 45;
  const maxWidth = 300;

  const widths = columns.map(col => {
    const headerLen = formatLabel(col).length;
    return Math.max(headerLen * charWidth + padding, minWidth);
  });

  const sampleSize = Math.min(fields.length, 20);
  for (let i = 0; i < sampleSize; i++) {
    const row = fields[i]?.value || {};
    columns.forEach((col, idx) => {
      const text = String(row[col] ?? "");
      const estimated = Math.min(text.length * charWidth + padding, maxWidth);
      widths[idx] = Math.max(widths[idx], estimated);
    });
  }

  const total = widths.reduce((a, b) => a + b, 0);
  return widths.map(w => (w / total) * availableWidth);
}

module.exports = Object.freeze({
  sanitizeFileName,
  buildFileName,
  sanitizeValue,
  normalizeModel,
  toBuffer,
  flattenSegments,
  segmentsToRows,
  isTableSegment,
  formatLabel,
  formatFieldValue,
  stripBrokenBar,
  calculateColumnWidths
});