// integrations/export/pdf.js

"use strict";

const PDFDocument = require("pdfkit");
const {
  normalizeModel,
  isTableSegment,
  formatLabel,
  formatFieldValue,
  stripBrokenBar,
  calculateColumnWidths
} = require("./utils");

const COLORS = {
  primary:   "#1A365D",
  secondary: "#2B6CB0",
  text:      "#2D3748",
  muted:     "#718096",
  light:     "#E2E8F0",
  bgHeader:  "EBF4FF",
  bgAlt:     "#F7FAFC",
  border:    "#CBD5E0"
};

const FONTS = {
  heading:  "Helvetica-Bold",
  body:     "Helvetica",
  bodyBold: "Helvetica-Bold"
};

const MARGIN = 60;
const BOTTOM_MARGIN = 60;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE_HEIGHT - BOTTOM_MARGIN) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

async function exportPDF(model = {}, config = {}) {
  const docModel = normalizeModel(model);
  const cfg = {
    branding: { companyName: "", showMetadata: true, primaryColor: COLORS.primary },
    includePageNumbers: true,
    ...config
  };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGIN,
      info: {
        Title: stripBrokenBar(docModel.fileName || "Document"),
        Author: cfg.branding.companyName || "Document Export",
        CreationDate: new Date()
      },
      bufferPages: true
    });

    const buffers = [];
    doc.on("data", chunk => buffers.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(buffers);
      resolve({
        buffer,
        mimeType: "application/pdf",
        extension: "pdf",
        fileName: `${stripBrokenBar(docModel.fileName || "document")}.pdf`
      });
    });
    doc.on("error", reject);

    /* ── Top accent bar ─────────────────────────────────── */
    doc.rect(0, 0, PAGE_WIDTH, 4).fill(COLORS.secondary);
    doc.y = 24;

    /* ── Optional Brand / Metadata Header ───────────────── */
    const metaY = doc.y;
    const metaRight = PAGE_WIDTH - MARGIN;

    if (cfg.branding.companyName) {
      doc.font(FONTS.heading).fontSize(18).fillColor(cfg.branding.primaryColor || COLORS.primary);
      doc.text(cfg.branding.companyName, MARGIN, metaY);
      doc.y = metaY + 22;
    }

    if (cfg.branding.showMetadata !== false) {
      const fileName = stripBrokenBar(docModel.fileName || "Untitled");
      const dateStr = new Date(docModel.extractedAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      doc.font(FONTS.body).fontSize(9).fillColor(COLORS.muted);
      const metaText = `${fileName}  ·  ${dateStr}`;
      doc.text(metaText, MARGIN, cfg.branding.companyName ? doc.y : metaY + 4, {
        align: cfg.branding.companyName ? "left" : "right",
        width: cfg.branding.companyName ? undefined : metaRight - MARGIN
      });

      if (!cfg.branding.companyName) {
        doc.y = metaY + 18;
      } else {
        doc.y += 4;
      }
    } else {
      doc.y = metaY + (cfg.branding.companyName ? 8 : 0);
    }

    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).stroke(COLORS.light);
    doc.y += 18;

    /* ── Segments ───────────────────────────────────────── */
    const segments = docModel.segments || [];

    for (const segment of segments) {
      const fields = segment.fields || [];
      if (!fields.length) continue;

      ensureSpace(doc, 40);

      const segY = doc.y;
      doc.rect(MARGIN, segY, 3, 16).fill(COLORS.secondary);
      doc.font(FONTS.heading).fontSize(12).fillColor(COLORS.primary);
      doc.text(stripBrokenBar(segment.segment_name || "Section"), MARGIN + 10, segY + 1);
      doc.y = segY + 24;

      if (isTableSegment(segment)) {
        renderTable(doc, segment);
      } else {
        renderKeyValue(doc, segment);
      }

      doc.y += 14;
    }

    /* ── Footer / Page Numbers ──────────────────────────── */
    const pageRange = doc.bufferedPageRange();
    const totalPages = pageRange.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const footerY = PAGE_HEIGHT - 36;

      if (cfg.includePageNumbers !== false) {
        doc.font(FONTS.body).fontSize(8).fillColor(COLORS.muted);
        // FIX: explicit width prevents overflow that was creating ghost pages
        doc.text(
          `Page ${i + 1} of ${totalPages}`,
          MARGIN,
          footerY,
          { align: "right", width: PAGE_WIDTH - (MARGIN * 2) }
        );
      }

      doc.rect(0, PAGE_HEIGHT - 4, PAGE_WIDTH, 4).fill(COLORS.secondary);
    }

    doc.end();
  });
}

/* ── Table Renderer ─────────────────────────────────────── */

function renderTable(doc, segment) {
  const fields = segment.fields || [];
  const columns = Object.keys(fields[0].value || {});
  const tableWidth = PAGE_WIDTH - (MARGIN * 2);

  const colWidths = calculateColumnWidths(columns, fields, tableWidth);
  const rowCount = fields.length;

  // Header
  ensureSpace(doc, 28);
  const headerY = doc.y;
  doc.rect(MARGIN, headerY - 2, tableWidth, 22).fill(COLORS.bgHeader);

  doc.font(FONTS.bodyBold).fontSize(8).fillColor(COLORS.primary);
  let hx = MARGIN;
  columns.forEach((col, i) => {
    doc.text(formatLabel(col), hx + 4, headerY + 5, { width: colWidths[i] - 8 });
    hx += colWidths[i];
  });
  doc.y = headerY + 24;

  // Rows
  for (let idx = 0; idx < rowCount; idx++) {
    const field = fields[idx];
    const row = field.value || {};

    doc.font(FONTS.body).fontSize(8);
    let maxH = 16;
    columns.forEach((col, i) => {
      const val = stripBrokenBar(String(row[col] ?? ""));
      const h = doc.heightOfString(val, { width: colWidths[i] - 8 });
      maxH = Math.max(maxH, h + 8);
    });
    const rowHeight = Math.max(20, maxH);

    ensureSpace(doc, rowHeight + 2);

    const rowY = doc.y;
    if (idx % 2 === 1) {
      doc.rect(MARGIN, rowY - 1, tableWidth, rowHeight).fill(COLORS.bgAlt);
    }

    doc.moveTo(MARGIN, rowY + rowHeight - 1)
       .lineTo(MARGIN + tableWidth, rowY + rowHeight - 1)
       .stroke(COLORS.border);

    doc.font(FONTS.body).fontSize(8).fillColor(COLORS.text);
    let cx = MARGIN;
    columns.forEach((col, i) => {
      const val = stripBrokenBar(String(row[col] ?? ""));
      doc.text(val, cx + 4, rowY + 4, { width: colWidths[i] - 8 });
      cx += colWidths[i];
    });

    doc.y = rowY + rowHeight;
  }

  doc.y += 6;
}

/* ── Key-Value Renderer ─────────────────────────────── */

function renderKeyValue(doc, segment) {
  const fields = segment.fields || [];
  const labelWidth = 160;
  const valueX = MARGIN + labelWidth + 20;
  const valueWidth = PAGE_WIDTH - MARGIN - valueX;

  for (let idx = 0; idx < fields.length; idx++) {
    const field = fields[idx];
    const label = stripBrokenBar(field.label || "");
    const value = formatFieldValue(field.value);

    doc.font(FONTS.bodyBold).fontSize(9);
    const labelH = doc.heightOfString(label, { width: labelWidth });
    doc.font(FONTS.body).fontSize(9);
    const valueH = doc.heightOfString(value, { width: valueWidth });
    const blockH = Math.max(labelH, valueH) + 10;

    ensureSpace(doc, blockH + 4);

    const y = doc.y;

    if (idx % 2 === 1) {
      doc.rect(MARGIN, y - 2, PAGE_WIDTH - MARGIN * 2, blockH).fill(COLORS.bgAlt);
    }

    doc.font(FONTS.bodyBold).fontSize(9).fillColor(COLORS.secondary);
    doc.text(label, MARGIN + 4, y + 4, { width: labelWidth });

    doc.font(FONTS.body).fontSize(9).fillColor(COLORS.text);
    doc.text(value, valueX, y + 4, { width: valueWidth });

    doc.y = y + blockH;
    doc.moveTo(MARGIN, doc.y - 2).lineTo(PAGE_WIDTH - MARGIN, doc.y - 2).dash(1, { space: 2 }).stroke(COLORS.light);
    doc.undash();
  }
}

module.exports = exportPDF;