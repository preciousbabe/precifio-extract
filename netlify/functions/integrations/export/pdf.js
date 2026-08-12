"use strict";

const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const {
  normalizeModel,
  isTableSegment,
  formatLabel,
  formatFieldValue,
  stripBrokenBar,
  calculateColumnWidths
} = require("./utils");


const PAGE_WIDTH  = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN      = 85;
const BOTTOM_MARGIN = 60;
const CONTENT_TOP   = PAGE_HEIGHT - MARGIN;
const CONTENT_BOTTOM = BOTTOM_MARGIN;

// Pre-computed pdf-lib rgb() colors — no helper function, zero ambiguity
const C = {
  primary:   rgb(26/255, 54/255, 93/255),
  secondary: rgb(43/255, 108/255, 176/255),
  text:      rgb(45/255, 55/255, 72/255),
  muted:     rgb(113/255, 128/255, 150/255),
  light:     rgb(226/255, 232/255, 240/255),
  bgHeader:  rgb(235/255, 244/255, 255/255),
  bgAlt:     rgb(247/255, 250/255, 252/255),
  border:    rgb(203/255, 213/255, 224/255),
};

function wrapText(text, font, size, maxWidth) {
  const str = stripBrokenBar(String(text ?? ""));
  if (!str) return [""];
  const words = str.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function normalizeColor(input) {
  if (!input) return C.primary;
  if (typeof input === "string") {
    const hex = input.replace(/^#/, "");
    if (hex.length === 6) {
      const bigint = parseInt(hex, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return rgb(r / 255, g / 255, b / 255);
    }
  }
  return input;
}

/* ─────────────────────────────────────────────── */

async function exportPDF(model = {}, config = {}) {
  const docModel = normalizeModel(model);
    const cfg = {
    branding: { companyName: "", showMetadata: true, primaryColor: C.primary },
    ...config
  };
  cfg.branding = cfg.branding || {};
  cfg.branding.primaryColor = normalizeColor(cfg.branding.primaryColor);

  const pdfDoc   = await PDFDocument.create();
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const ctx = {
    pdfDoc,
    pages: [],
    page: null,
    y: 0,
    bodyFont,
    boldFont,
    cfg
  };

  // First page
  ctx.page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.pages.push(ctx.page);
  ctx.y = CONTENT_TOP;

  // Top accent bar
  ctx.page.drawRectangle({
    x: 0, y: PAGE_HEIGHT - 4, width: PAGE_WIDTH, height: 4, color: C.secondary
  });

  drawHeader(ctx, docModel);

  const segments = docModel.segments || [];
  for (const segment of segments) {
    if (!segment.fields?.length) continue;
    drawSegment(ctx, segment);
  }

  // Footer on every page we actually created
  const totalPages = ctx.pages.length;
  ctx.pages.forEach((page, idx) => {
    page.drawRectangle({
      x: 0, y: 0, width: PAGE_WIDTH, height: 4, color: C.secondary
    });

    if (cfg.includePageNumbers !== false) {
      const text = `Page ${idx + 1} of ${totalPages}`;
      const tw   = bodyFont.widthOfTextAtSize(text, 8);
      page.drawText(text, {
        x: PAGE_WIDTH - MARGIN - tw,
        y: 20,
        size: 8,
        font: bodyFont,
        color: C.muted
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  return {
    buffer: Buffer.from(pdfBytes),
    mimeType: "application/pdf",
    extension: "pdf",
    fileName: `${stripBrokenBar(docModel.fileName || "document")}.pdf`
  };
}

/* ── Header ───────────────────────────────────── */

function drawHeader(ctx, docModel) {
  const { cfg, page, boldFont, bodyFont } = ctx;
  let y = ctx.y;

  const metaText = `${stripBrokenBar(docModel.fileName || "Untitled")}  ·  ${new Date(docModel.extractedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
  })}`;

  if (cfg.branding.companyName) {
    page.drawText(stripBrokenBar(cfg.branding.companyName), {
      x: MARGIN, y, size: 18, font: boldFont, color: cfg.branding.primaryColor
    });
    y -= 24;
    page.drawText(metaText, { x: MARGIN, y, size: 9, font: bodyFont, color: C.muted });
    y -= 20;
  } else {
    const tw = bodyFont.widthOfTextAtSize(metaText, 9);
    page.drawText(metaText, {
      x: PAGE_WIDTH - MARGIN - tw, y, size: 9, font: bodyFont, color: C.muted
    });
    y -= 20;
  }

  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end:   { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 0.5,
    color: C.light
  });
  y -= 10;
  ctx.y = y;
}

/* ── Page / Segment helpers ───────────────────── */

function ensureSpace(ctx, needed) {
  if (ctx.y - needed < CONTENT_BOTTOM) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.pages.push(ctx.page);
    ctx.y = CONTENT_TOP;
  }
}

function drawSegment(ctx, segment) {
  ensureSpace(ctx, 40);
  const { page, boldFont } = ctx;
  const title = stripBrokenBar(segment.segment_name || "Section");

  page.drawRectangle({
    x: MARGIN, y: ctx.y - 16, width: 3, height: 16, color: C.secondary
  });

  page.drawText(title, {
    x: MARGIN + 10, y: ctx.y - 12, size: 12, font: boldFont, color: C.primary
  });
  ctx.y -= 28;

  if (isTableSegment(segment)) {
    drawTable(ctx, segment);
  } else {
    drawKeyValue(ctx, segment);
  }
  ctx.y -= 18;
}

/* ── Key-Value ────────────────────────────────── */

function drawKeyValue(ctx, segment) {
  const fields = segment.fields || [];
  const labelWidth = 160;
  const valueX     = MARGIN + labelWidth + 20;
  const valueWidth = PAGE_WIDTH - MARGIN - valueX;
  const lineHeight = 12;

  for (let idx = 0; idx < fields.length; idx++) {
    const label = stripBrokenBar(fields[idx].label || "");
    const value = formatFieldValue(fields[idx].value);

    const labelLines = wrapText(label, ctx.boldFont, 9, labelWidth);
    const valueLines = wrapText(value, ctx.bodyFont, 9, valueWidth);
    const blockH = Math.max(labelLines.length, valueLines.length) * lineHeight + 12;

    ensureSpace(ctx, blockH + 4);
    const y = ctx.y;

    if (idx % 2 === 1) {
      ctx.page.drawRectangle({
        x: MARGIN, y: y - blockH + 2,
        width: PAGE_WIDTH - MARGIN * 2, height: blockH,
        color: C.bgAlt
      });
    }

       labelLines.forEach((line, i) => {
  ctx.page.drawText(line, {
    x: MARGIN + 4,
    y: y - 8 - (i * lineHeight),
    size: 9,
    font: ctx.boldFont,
    color: C.secondary
  });
});

valueLines.forEach((line, i) => {
  ctx.page.drawText(line, {
    x: valueX,
    y: y - 8 - (i * lineHeight),
    size: 9,
    font: ctx.bodyFont,
    color: C.text
  });
});


    ctx.y = y - blockH;
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y + 2 },
      end:   { x: PAGE_WIDTH - MARGIN, y: ctx.y + 2 },
      thickness: 0.5,
      color: C.light
    });
  }
}

/* ── Table ────────────────────────────────────── */

function drawTable(ctx, segment) {
  const fields   = segment.fields || [];
  const columns  = Object.keys(fields[0].value || {});
  const tableW   = PAGE_WIDTH - (MARGIN * 2);
  if (!columns.length) return;

  const colWidths  = calculateColumnWidths(columns, fields, tableW);
  const lineHeight = 10.5;
  const hdrH       = 24;

  ensureSpace(ctx, hdrH);
  const hdrY = ctx.y;

  ctx.page.drawRectangle({
    x: MARGIN, y: hdrY - hdrH, width: tableW, height: hdrH, color: C.bgHeader
  });


  let hx = MARGIN;
    columns.forEach((col, i) => {
    ctx.page.drawText(formatLabel(col), {
      x: hx + 4, y: hdrY - 18, size: 8, font: ctx.boldFont, color: C.primary
    });
    hx += colWidths[i];
  });


  ctx.page.drawLine({
    start: { x: MARGIN, y: hdrY - hdrH },
    end:   { x: MARGIN + tableW, y: hdrY - hdrH },
    thickness: 1, color: C.secondary
  });

  ctx.y = hdrY - hdrH;

  fields.forEach((field, idx) => {
    const row = field.value || {};
    let maxH = 20;
    columns.forEach((col, i) => {
      const text = stripBrokenBar(String(row[col] ?? ""));
      const cw   = colWidths[i] - 8;
      const lines = wrapText(text, ctx.bodyFont, 8, cw);
      maxH = Math.max(24, lines.length * lineHeight + 10);
    });

    ensureSpace(ctx, maxH + 2);
    const rowY = ctx.y;

    if (idx % 2 === 1) {
      ctx.page.drawRectangle({
        x: MARGIN, y: rowY - maxH, width: tableW, height: maxH, color: C.bgAlt
      });
    }

    ctx.page.drawLine({
      start: { x: MARGIN, y: rowY - maxH },
      end:   { x: MARGIN + tableW, y: rowY - maxH },
      thickness: 0.5, color: C.border
    });

    let cx = MARGIN;
    columns.forEach((col, i) => {
      const text  = stripBrokenBar(String(row[col] ?? ""));
      const cw    = colWidths[i] - 8;
      const lines = wrapText(text, ctx.bodyFont, 8, cw);

           lines.forEach((line, li) => {
        ctx.page.drawText(line, {
          x: cx + 4, y: rowY - 14 - (li * lineHeight),
          size: 8, font: ctx.bodyFont, color: C.text
        });
      });

      cx += colWidths[i];
    });

    ctx.y = rowY - maxH;
  });

  ctx.y -= 6;
}

module.exports = exportPDF;