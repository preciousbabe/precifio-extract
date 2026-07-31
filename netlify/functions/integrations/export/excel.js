// integrations/export/excel.js

"use strict";

const ExcelJS = require("exceljs");
const {
  normalizeModel,
  isTableSegment,
  formatLabel,
  formatFieldValue,
  stripBrokenBar
} = require("./utils");

const types = require("./types");
const TYPE = types.get("excel");

const COLORS = {
  primary:   "1A365D",
  secondary: "2B6CB0",
  text:      "2D3748",
  muted:     "718096",
  light:     "E2E8F0",
  bgHeader:  "EBF4FF",
  bgAlt:     "F7FAFC",
  border:    "CBD5E0"
};

function sanitizeSheetName(name) {
  // Excel sheet names: max 31 chars, cannot contain: \ / ? * [ ]
  return stripBrokenBar(name)
    .replace(/[\\/*[\]?]/g, "")
    .substring(0, 31) || "Sheet";
}

function isNumeric(str) {
  if (typeof str !== "string") return false;
  return str.trim() !== "" && !isNaN(str) && !isNaN(parseFloat(str));
}


function setCellValue(cell, raw) {
  if (raw === null || raw === undefined) {
    cell.value = "";
    return;
  }
  if (typeof raw === "boolean") {
    cell.value = raw ? "Yes" : "No";
    return;
  }
  if (typeof raw === "number") {
    cell.value = raw;
    return;
  }
  if (typeof raw === "string" && isNumeric(raw)) {
    cell.value = parseFloat(raw);
    return;
  }

  // ── ADD THIS BLOCK ──
  if (typeof raw === "object") {
    cell.value = formatFieldValue(raw);
    return;
  }
  // ────────────────────

  cell.value = String(raw);
}

async function exportExcel(model = {}, config = {}) {
  const docModel = normalizeModel(model);
  const cfg = {
    branding: { companyName: "", showMetadata: true },
    ...config
  };

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.modified = new Date();

  const segments = docModel.segments || [];
  const details = segments.filter(s => !isTableSegment(s));
  const tables = segments.filter(s => isTableSegment(s));

  /* ── Summary Sheet ──────────────────────────────────── */
  if (details.length > 0 || cfg.branding.showMetadata) {
    const summary = workbook.addWorksheet("Summary");

    let rowIdx = 1;

    if (cfg.branding.companyName) {
      summary.mergeCells(rowIdx, 1, rowIdx, 3);
      const brandCell = summary.getCell(rowIdx, 1);
      brandCell.value = cfg.branding.companyName;
      brandCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLORS.primary } };
      rowIdx += 2;
    }

    if (cfg.branding.showMetadata !== false) {
      summary.getCell(rowIdx, 1).value = "Document:";
      summary.getCell(rowIdx, 1).font = { bold: true, color: { argb: COLORS.muted }, size: 10 };
      summary.getCell(rowIdx, 2).value = stripBrokenBar(docModel.fileName || "Untitled");
      summary.getCell(rowIdx, 2).font = { color: { argb: COLORS.text }, size: 10 };
      rowIdx++;

      summary.getCell(rowIdx, 1).value = "Extracted:";
      summary.getCell(rowIdx, 1).font = { bold: true, color: { argb: COLORS.muted }, size: 10 };
      summary.getCell(rowIdx, 2).value = new Date(docModel.extractedAt).toLocaleString("en-US");
      summary.getCell(rowIdx, 2).font = { color: { argb: COLORS.text }, size: 10 };
      rowIdx += 2;
    }

    for (const segment of details) {
      const fields = segment.fields || [];
      if (!fields.length) continue;

      // Segment header
      summary.mergeCells(rowIdx, 1, rowIdx, 3);
      const segCell = summary.getCell(rowIdx, 1);
      segCell.value = formatLabel(segment.segment_name) || "Section";
      segCell.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.primary } };
      segCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bgHeader } };
      summary.getRow(rowIdx).height = 26;
      rowIdx++;

      fields.forEach((field, idx) => {
        const row = summary.getRow(rowIdx);
        const labelCell = row.getCell(1);
        const valueCell = row.getCell(2);

        labelCell.value = formatLabel(field.label);
        labelCell.font = { bold: true, color: { argb: COLORS.text }, size: 10 };
        labelCell.border = { bottom: { style: "thin", color: { argb: COLORS.light } } };

        setCellValue(valueCell, field.value);
        valueCell.font = { color: { argb: COLORS.text }, size: 10 };
        valueCell.border = { bottom: { style: "thin", color: { argb: COLORS.light } } };

        if (idx % 2 === 1) {
          labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bgAlt } };
          valueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bgAlt } };
        }

        row.height = 22;
        rowIdx++;
      });

      rowIdx++; // spacer between segments
    }

    summary.columns = [{ width: 30 }, { width: 50 }, { width: 20 }];
  }

  /* ── Table Sheets ───────────────────────────────────── */
  for (const segment of tables) {
    const fields = segment.fields || [];
    if (!fields.length) continue;

    const sheetName = sanitizeSheetName(segment.segment_name || "Table");
    const sheet = workbook.addWorksheet(sheetName);
    const columns = Object.keys(fields[0].value || {});

    // Header row
    const headerRow = sheet.getRow(1);
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = formatLabel(col);
      cell.font = { bold: true, color: { argb: COLORS.primary }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D6E4FF" } };
      cell.border = { bottom: { style: "medium", color: { argb: COLORS.secondary } } };
      cell.alignment = { vertical: "middle" };
    });
    sheet.getRow(1).height = 24;

    // Data rows
    fields.forEach((field, rIdx) => {
      const rowData = field.value || {};
      const row = sheet.getRow(rIdx + 2);
      columns.forEach((col, cIdx) => {
        const cell = row.getCell(cIdx + 1);
        setCellValue(cell, rowData[col]);
        cell.font = { color: { argb: COLORS.text }, size: 10 };
        if (rIdx % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bgAlt } };
        }
        cell.border = { bottom: { style: "thin", color: { argb: COLORS.light } } };
      });
      row.height = 22;
    });

    // Auto-width (rough heuristic)
    const colWidths = columns.map(col => Math.max(formatLabel(col).length, 10));
    const sample = fields.slice(0, 10);
    sample.forEach(field => {
      const row = field.value || {};
      columns.forEach((col, idx) => {
        const len = String(row[col] ?? "").length;
        colWidths[idx] = Math.max(colWidths[idx], Math.min(len, 50));
      });
    });
    sheet.columns = colWidths.map(w => ({ width: Math.min(w * 1.1 + 2, 60) }));
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer,
    mimeType: TYPE.mimeType,
    extension: TYPE.extension,
    fileName: `${stripBrokenBar(docModel.fileName || "document")}.${TYPE.extension}`
  };
}

module.exports = exportExcel;