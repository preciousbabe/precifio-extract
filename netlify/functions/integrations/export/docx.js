"use strict";

const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, BorderStyle, ShadingType,
  AlignmentType, VerticalAlign, Footer, PageNumber
} = require("docx");

const { normalizeModel, isTableSegment, formatLabel, formatFieldValue } = require("./utils");

const COLORS = {
  primary:   "1A365D",
  secondary: "2B6CB0",
  text:      "2D3748",
  muted:     "718096",
  light:     "E2E8F0",
  bgHeader:  "EBF4FF",
  bgAlt:     "F7FAFC"
};

const FONTS = { heading: "Calibri", body: "Calibri" };
const SIZES = { title: 56, subtitle: 22, body: 22, small: 20, meta: 18 };
const SPACING = { paragraph: 120, tight: 60, sectionGap: 200 };

const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: COLORS.light };
const TABLE_BORDERS = {
  top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER,
  insideHorizontal: TABLE_BORDER, insideVertical: TABLE_BORDER
};

function makeText(text, opts = {}) {
  return new TextRun({
    text: String(text || ""),
    font: opts.font || FONTS.body,
    size: opts.size || SIZES.body,
    color: opts.color || COLORS.text,
    bold: opts.bold || false,
    italics: opts.italics || false
  });
}

function makeCell(text, opts = {}) {
  return new TableCell({
    borders: TABLE_BORDERS,
    shading: opts.shading
      ? { fill: opts.shading, type: ShadingType.CLEAR }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          makeText(text, {
            size: opts.size || SIZES.body,
            bold: opts.bold || false,
            color: opts.color || COLORS.text
          })
        ]
      })
    ]
  });
}

async function exportDOCX(model, config = {}) {
  const docModel = normalizeModel(model);
  const cfg = {
    branding: { companyName: "", showMetadata: true },
    includePageNumbers: true,
    ...config
  };

  const children = [];

  /* ── Brand / Metadata ───────────────────────── */
  if (cfg.branding.companyName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: SPACING.tight },
        children: [
          makeText(cfg.branding.companyName, {
            size: SIZES.title,
            color: COLORS.primary,
            bold: true,
            font: FONTS.heading
          })
        ]
      })
    );
  }

  if (cfg.branding.showMetadata !== false) {
    const metaParts = [];
    if (docModel.fileName) metaParts.push(`Document: ${docModel.fileName}`);
    metaParts.push(new Date(docModel.extractedAt).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    }));

    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: SPACING.sectionGap },
        children: [
          makeText(metaParts.join("  ·  "), {
            size: SIZES.meta,
            color: COLORS.muted
          })
        ]
      })
    );
  }

  /* ── Segments ───────────────────────────────── */
  for (const segment of docModel.segments || []) {
    const fields = segment.fields || [];
    if (!fields.length) continue;

    children.push(new Paragraph({
      spacing: { before: SPACING.sectionGap, after: SPACING.tight },
      children: [
        makeText(segment.segment_name || "Section", {
          font: FONTS.heading,
          size: SIZES.subtitle,
          color: COLORS.primary,
          bold: true
        })
      ]
    }));

    if (isTableSegment(segment)) {
      const columns = Object.keys(fields[0].value || {});
      const colCount = columns.length;
      const totalTwips = 9000;            // ~usable width for A4 with 1" margins
      const colWidth   = Math.floor(totalTwips / Math.max(colCount, 1));

      const tableRows = [
        new TableRow({
          children: columns.map(col =>
            makeCell(formatLabel(col), {
              shading: COLORS.bgHeader,
              bold: true,
              color: COLORS.primary,
              width: colWidth
            })
          )
        })
      ];

      fields.forEach((field, idx) => {
        const row = field.value || {};
        tableRows.push(new TableRow({
          children: columns.map(col =>
            makeCell(row[col] || "", {
              shading: idx % 2 === 1 ? COLORS.bgAlt : undefined,
              width: colWidth
            })
          )
        }));
      });

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: Array(colCount).fill(colWidth),
        rows: tableRows
      }));
    } else {
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3200, 5800],
        rows: fields.map((field, idx) => {
          return new TableRow({
            children: [
              makeCell(formatLabel(field.label) || "", {
                shading: idx % 2 === 1 ? COLORS.bgAlt : undefined,
                width: 3200,
                bold: true
              }),
              makeCell(formatFieldValue(field.value), {
                shading: idx % 2 === 1 ? COLORS.bgAlt : undefined,
                width: 5800
              })
            ]
          });
        })
      });

      children.push(table);
    }

    children.push(new Paragraph({ spacing: { after: SPACING.paragraph }, children: [] }));
  }

  /* ── Footer / Page Numbers ──────────────────── */
  const footers = {};
  if (cfg.includePageNumbers !== false) {
    footers.default = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 0 },
          children: [
            makeText("Page ", { size: SIZES.meta, color: COLORS.muted }),
            new TextRun({ children: [PageNumber.CURRENT], size: SIZES.meta, color: COLORS.muted, font: FONTS.body }),
            makeText(" of ", { size: SIZES.meta, color: COLORS.muted }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: SIZES.meta, color: COLORS.muted, font: FONTS.body })
          ]
        })
      ]
    });
  }

  const document = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONTS.body, size: SIZES.body, color: COLORS.text },
          paragraph: { spacing: { after: SPACING.paragraph, line: 276 } }
        }
      }
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
      },
      children,
      footers
    }]
  });

  const buffer = await Packer.toBuffer(document);

  return {
    buffer,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extension: "docx",
    fileName: `${docModel.fileName || "document"}.docx`
  };
}

module.exports = exportDOCX;