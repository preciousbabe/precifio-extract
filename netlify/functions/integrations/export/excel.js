"use strict";

const ExcelJS = require("exceljs");

const {
  normalizeModel,
  formatLabel,
  formatFieldValue,
  stripBrokenBar
} = require("./utils");

const types = require("./types");
const TYPE = types.get("excel");

/* ============================================================================
 * COLORS
 * ========================================================================== */

const COLORS = {
  primary: "1A365D",
  secondary: "2B6CB0",
  text: "2D3748",
  muted: "718096",
  light: "E2E8F0",
  bgHeader: "EBF4FF",
  bgTableHeader: "D6E4FF",
  bgAlt: "F7FAFC",
  border: "CBD5E0",
  white: "FFFFFF"
};

/* ============================================================================
 * BASIC HELPERS
 * ========================================================================== */

function sanitizeSheetName(name) {
  return stripBrokenBar(String(name || "Sheet"))
    .replace(/[\\/*?:[\]]/g, "")
    .substring(0, 31) || "Sheet";
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isNumeric(value) {
  if (typeof value === "number") return true;

  if (typeof value !== "string") return false;

  const trimmed = value.trim();

  if (!trimmed) return false;

  return (
    !isNaN(trimmed) &&
    !isNaN(parseFloat(trimmed))
  );
}

/* ============================================================================
 * CELL VALUE HANDLING
 * ========================================================================== */

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

  /*
   * Only convert strings that are genuinely numeric.
   *
   * Examples:
   *   "123"          -> 123
   *   "1250.50"      -> 1250.5
   *
   * But:
   *   "850,000.00 NGN"
   *   "5%"
   *   "INV-2026-8842"
   *
   * remain strings.
   */
  if (typeof raw === "string" && isNumeric(raw)) {
    cell.value = parseFloat(raw);
    return;
  }

  if (Array.isArray(raw)) {
    cell.value = raw
      .map(value => formatFieldValue(value))
      .join(", ");
    return;
  }

  if (typeof raw === "object") {
    cell.value = formatFieldValue(raw);
    return;
  }

  cell.value = String(raw);
}


function getTableShape(segment) {
  const fields = Array.isArray(segment?.fields)
    ? segment.fields
    : [];

  if (!fields.length) {
    return null;
  }

  /*
   * --------------------------------------------------------------------------
   * Pattern A
   *
   * Multiple fields where each field.value is a row object.
   * --------------------------------------------------------------------------
   */

  const objectRows = fields.filter(field =>
    isPlainObject(field?.value)
  );

  if (
    objectRows.length >= 2 &&
    objectRows.length === fields.length
  ) {
    const columns = [];

    for (const field of objectRows) {
      for (const key of Object.keys(field.value)) {
        if (!columns.includes(key)) {
          columns.push(key);
        }
      }
    }

    if (columns.length > 0) {
      return {
  columns,
  rows: objectRows.map(field => ({
    value: field.value
  }))
   };
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Pattern B
   *
   * One field whose value is an array of row objects.
   * --------------------------------------------------------------------------
   */

  if (fields.length === 1 && Array.isArray(fields[0]?.value)) {
    const arrayRows = fields[0].value;

    const objectArrayRows = arrayRows.filter(isPlainObject);

    if (
      objectArrayRows.length > 0 &&
      objectArrayRows.length === arrayRows.length
    ) {
      const columns = [];

      for (const row of objectArrayRows) {
        for (const key of Object.keys(row)) {
          if (!columns.includes(key)) {
            columns.push(key);
          }
        }
      }

      if (columns.length > 0) {
        return {
          columns,
          rows: objectArrayRows.map(row => ({
            value: row,
          }))
        };
      }
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Pattern C
   *
   * Explicit table segment.
   *
   * This is intentionally more permissive because a segment marked as
   * "table" should be treated as a table whenever possible.
   * --------------------------------------------------------------------------
   */

  const segmentType = String(
    segment?.segment_type || ""
  ).toLowerCase();

  if (segmentType === "table") {
    const rows = [];

    for (const field of fields) {
      if (isPlainObject(field?.value)) {
        rows.push({
          value: field.value,
        });
      }
    }

    if (rows.length > 0) {
      const columns = [];

      for (const row of rows) {
        for (const key of Object.keys(row.value)) {
          if (!columns.includes(key)) {
            columns.push(key);
          }
        }
      }

      if (columns.length > 0) {
        return {
          columns,
          rows
        };
      }
    }

    /*
     * Explicit table containing an array may also occur.
     */
    if (
      fields.length === 1 &&
      Array.isArray(fields[0]?.value)
    ) {
      const arrayRows = fields[0].value.filter(isPlainObject);

      if (arrayRows.length > 0) {
        const columns = [];

        for (const row of arrayRows) {
          for (const key of Object.keys(row)) {
            if (!columns.includes(key)) {
              columns.push(key);
            }
          }
        }

        return {
          columns,
          rows: arrayRows.map(row => ({
            value: row,
          }))
        };
      }
    }
  }

  return null;
}


/* ============================================================================
 * EMAIL / MARKDOWN CLEANUP
 * ========================================================================== */

function cleanDisplayValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  /*
   * Convert markdown mail links such as:
   *
   * [billing@company.com](mailto\:billing@company.com)
   *
   * into:
   *
   * billing@company.com
   */

  const markdownEmail = value.match(
    /^\[([^\]]+)\]\(mailto\\?:([^)]+)\)$/
  );

  if (markdownEmail) {
    return markdownEmail[1];
  }

  return value;
}

/* ============================================================================
 * STYLE HELPERS
 * ========================================================================== */

function styleSectionHeader(row, columnCount) {
  if (columnCount > 1) {
    row.worksheet.mergeCells(
      row.number,
      1,
      row.number,
      columnCount
    );
  }

  const cell = row.getCell(1);

  cell.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: COLORS.primary }
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.bgHeader }
  };

  cell.alignment = {
    vertical: "middle"
  };

  row.height = 26;
}

function styleNormalCell(cell, alternate = false) {
  cell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: COLORS.text }
  };

  cell.border = {
    bottom: {
      style: "thin",
      color: { argb: COLORS.light }
    }
  };

  if (alternate) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.bgAlt }
    };
  }

  cell.alignment = {
    vertical: "top",
    wrapText: true
  };
}

function styleTableHeader(cell) {
  cell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: COLORS.primary }
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.bgTableHeader }
  };

  cell.border = {
    top: {
      style: "thin",
      color: { argb: COLORS.secondary }
    },
    bottom: {
      style: "medium",
      color: { argb: COLORS.secondary }
    },
    left: {
      style: "thin",
      color: { argb: COLORS.light }
    },
    right: {
      style: "thin",
      color: { argb: COLORS.light }
    }
  };

  cell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true
  };
}

function styleTableCell(cell, alternate = false) {
  cell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: COLORS.text }
  };

  if (alternate) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.bgAlt }
    };
  }

  cell.border = {
    bottom: {
      style: "thin",
      color: { argb: COLORS.light }
    },
    left: {
      style: "thin",
      color: { argb: COLORS.light }
    },
    right: {
      style: "thin",
      color: { argb: COLORS.light }
    }
  };

  cell.alignment = {
    vertical: "top",
    wrapText: true
  };
}

/* ============================================================================
 * DYNAMIC WIDTH CALCULATION
 * ========================================================================== */

function calculateDynamicWidths(sheet, startRow, endRow, columnCount) {
  const widths = [];

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
    let maxLength = 10;

    for (
      let rowIndex = startRow;
      rowIndex <= endRow;
      rowIndex++
    ) {
      const cell = sheet.getCell(
        rowIndex,
        columnIndex
      );

      let value = cell.value;

      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === "object") {
        if (value.text) {
          value = value.text;
        } else {
          value = String(value);
        }
      }

      const text = String(value)
        .replace(/\r?\n/g, " ")
        .trim();

      if (!text) continue;

      maxLength = Math.max(
        maxLength,
        text.length
      );
    }

    /*
     * We don't hardcode document-specific widths.
     *
     * The exporter derives widths from the actual content,
     * while still applying sensible Excel limits.
     */

    const width = Math.min(
      Math.max(maxLength + 3, 12),
      55
    );

    widths.push(width);
  }

  return widths;
}

/* ============================================================================
 * TABLE RENDERING
 *
 * IMPORTANT:
 * Tables are rendered directly into Summary.
 *
 * They are NOT moved to another worksheet.
 * ========================================================================== */

function createTableInSummary(
  sheet,
  segment,
  shape,
  rowIdx
) {
  if (
    !shape ||
    !shape.columns ||
    !shape.columns.length ||
    !shape.rows ||
    !shape.rows.length
  ) {
    return rowIdx;
  }

  const columns = [...shape.columns];

  
  /*
   * --------------------------------------------------------------------------
   * Section title
   * --------------------------------------------------------------------------
   */

  const titleRow = sheet.getRow(rowIdx);

  titleRow.getCell(1).value =
    formatLabel(segment.segment_name) || "Table";

  styleSectionHeader(
    titleRow,
    columns.length
  );

  rowIdx++;

  /*
   * --------------------------------------------------------------------------
   * Table header
   * --------------------------------------------------------------------------
   */

  const headerRow = sheet.getRow(rowIdx);

  columns.forEach((column, columnIndex) => {
    const cell = headerRow.getCell(
      columnIndex + 1
    );

    cell.value =
      column === "__precifio_confidence__"
        ? "Conf."
        : formatLabel(column);

    styleTableHeader(cell);
  });

  headerRow.height = 28;

  rowIdx++;

  /*
   * --------------------------------------------------------------------------
   * Table rows
   * --------------------------------------------------------------------------
   */

  const dataStartRow = rowIdx;

  shape.rows.forEach((tableRow, rowIndex) => {
    const row = sheet.getRow(rowIdx);

    const rowData = isPlainObject(tableRow.value)
      ? tableRow.value
      : {};

    columns.forEach((column, columnIndex) => {
      const cell = row.getCell(
        columnIndex + 1
      );

    const rawValue = rowData[column];

const cleanedValue =
  cleanDisplayValue(rawValue);

setCellValue(
  cell,
  cleanedValue
   );
      styleTableCell(
        cell,
        rowIndex % 2 === 1
      );
    });

    /*
     * Let wrapped text determine visual height better than forcing
     * every row to exactly the same height.
     */

    row.height = 30;

    rowIdx++;
  });

  const dataEndRow = rowIdx - 1;

  /*
   * --------------------------------------------------------------------------
   * Dynamic widths
   * --------------------------------------------------------------------------
   */

  const widths = calculateDynamicWidths(
    sheet,
    dataStartRow - 1,
    dataEndRow,
    columns.length
  );

  /*
   * Don't overwrite Summary's entire column configuration.
   *
   * Apply the calculated width to the columns currently used by
   * this table.
   */

  widths.forEach((width, index) => {
    const column = sheet.getColumn(index + 1);

    /*
     * If another section/table already required a wider column,
     * keep the wider value.
     */

    if (
      !column.width ||
      column.width < width
    ) {
      column.width = width;
    }
  });

  /*
   * Small spacer after table.
   */

  rowIdx++;

  return rowIdx;
}

/* ============================================================================
 * NORMAL KEY/VALUE SECTION
 * ========================================================================== */

function createKeyValueSection(
  sheet,
  segment,
  fields,
  rowIdx
) {
  if (!fields.length) {
    return rowIdx;
  }

  /*
   * Section heading
   */

  const sectionRow = sheet.getRow(rowIdx);

  sectionRow.getCell(1).value =
    formatLabel(segment.segment_name) ||
    "Section";

  styleSectionHeader(
    sectionRow,
    3
  );

  rowIdx++;

  /*
   * Fields
   */

  fields.forEach((field, index) => {
    const row = sheet.getRow(rowIdx);

    const labelCell = row.getCell(1);
    const valueCell = row.getCell(2);

    labelCell.value =
      formatLabel(field.label);

    styleNormalCell(
      labelCell,
      index % 2 === 1
    );

    labelCell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COLORS.text }
    };

    const cleanedValue =
      cleanDisplayValue(field.value);

    setCellValue(
      valueCell,
      cleanedValue
    );

    styleNormalCell(
      valueCell,
      index % 2 === 1
    );

  
    row.height = 24;

    rowIdx++;
  });

  /*
   * Spacer
   */

  rowIdx++;

  return rowIdx;
}

/* ============================================================================
 * MAIN EXCEL EXPORTER
 * ========================================================================== */

async function exportExcel(
  model = {},
  config = {}
) {
  const docModel = normalizeModel(model);

  const cfg = {
    branding: {
      companyName: "",
      showMetadata: true
    },
    ...config
  };

  const workbook =
    new ExcelJS.Workbook();

  workbook.created = new Date();
  workbook.modified = new Date();

  /*
   * --------------------------------------------------------------------------
   * Summary worksheet
   * --------------------------------------------------------------------------
   */

  const summary =
    workbook.addWorksheet("Summary");

  summary.views = [
    {
      state: "frozen",
      ySplit: 1
    }
  ];

  let rowIdx = 1;

  /*
   * --------------------------------------------------------------------------
   * Branding
   * --------------------------------------------------------------------------
   */

  if (cfg.branding.companyName) {
    summary.mergeCells(
      rowIdx,
      1,
      rowIdx,
      3
    );

    const brandCell =
      summary.getCell(rowIdx, 1);

    brandCell.value =
      cfg.branding.companyName;

    brandCell.font = {
      name: "Calibri",
      size: 16,
      bold: true,
      color: { argb: COLORS.primary }
    };

    rowIdx += 2;
  }

  /*
   * --------------------------------------------------------------------------
   * Metadata
   * --------------------------------------------------------------------------
   */

  if (
    cfg.branding.showMetadata !== false
  ) {
    const documentLabel =
      summary.getCell(rowIdx, 1);

    documentLabel.value = "Document:";

    documentLabel.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COLORS.muted }
    };

    const documentValue =
      summary.getCell(rowIdx, 2);

    documentValue.value =
      stripBrokenBar(
        docModel.fileName ||
        "Untitled"
      );

    documentValue.font = {
      name: "Calibri",
      size: 10,
      color: { argb: COLORS.text }
    };

    rowIdx++;

    const extractedLabel =
      summary.getCell(rowIdx, 1);

    extractedLabel.value =
      "Extracted:";

    extractedLabel.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COLORS.muted }
    };

    const extractedValue =
      summary.getCell(rowIdx, 2);

    const extractedDate =
      new Date(docModel.extractedAt);

    extractedValue.value =
      Number.isNaN(
        extractedDate.getTime()
      )
        ? String(docModel.extractedAt || "")
        : extractedDate.toLocaleString(
            "en-US"
          );

    extractedValue.font = {
      name: "Calibri",
      size: 10,
      color: { argb: COLORS.text }
    };

    rowIdx += 2;
  }

  /*
   * --------------------------------------------------------------------------
   * Segments
   *
   * Every segment is now rendered into Summary.
   *
   * Table segments are rendered as actual Excel tables inside Summary.
   * Normal segments remain key/value sections.
   * --------------------------------------------------------------------------
   */

  const segments =
    Array.isArray(docModel.segments)
      ? docModel.segments
      : [];

  for (const segment of segments) {
    const fields =
      Array.isArray(segment?.fields)
        ? segment.fields
        : [];

    if (!fields.length) {
      continue;
    }

    const tableShape =
      getTableShape(segment);

    /*
     * TABLE
     */

    if (
      tableShape &&
      tableShape.columns.length > 0 &&
      tableShape.rows.length > 0
    ) {
      rowIdx =
        createTableInSummary(
          summary,
          segment,
          tableShape,
          rowIdx
        );

      continue;
    }

    /*
     * NORMAL KEY/VALUE SECTION
     */

    rowIdx =
      createKeyValueSection(
        summary,
        segment,
        fields,
        rowIdx
      );
  }

  /*
   * --------------------------------------------------------------------------
   * Global Summary column widths
   *
   * These are not document-specific hardcoded widths.
   * We derive them from the actual worksheet content.
   * --------------------------------------------------------------------------
   */

  const summaryWidths =
    calculateDynamicWidths(
      summary,
      1,
      Math.max(rowIdx, 1),
      3
    );

  summaryWidths.forEach(
    (width, index) => {
      const column =
        summary.getColumn(
          index + 1
        );

      column.width =
        Math.max(
          column.width || 0,
          width
        );
    }
  );

  /*
   * The first column is the label / table Item column.
   *
   * We still allow content-driven sizing, but avoid letting a gigantic
   * paragraph make the entire workbook absurdly wide.
   */

  summary.getColumn(1).width =
    Math.min(
      Math.max(
        summary.getColumn(1).width || 12,
        18
      ),
      55
    );

  summary.getColumn(2).width =
    Math.min(
      Math.max(
        summary.getColumn(2).width || 12,
        20
      ),
      60
    );

  summary.getColumn(3).width =
    Math.min(
      Math.max(
        summary.getColumn(3).width || 12,
        12
      ),
      25
    );

  /*
   * --------------------------------------------------------------------------
   * Workbook calculation settings
   * --------------------------------------------------------------------------
   */

  workbook.calcProperties.fullCalcOnLoad =
    true;

  workbook.calcProperties.forceFullCalc =
    true;

  /*
   * --------------------------------------------------------------------------
   * Generate XLSX buffer
   * --------------------------------------------------------------------------
   */

  const buffer =
    await workbook.xlsx.writeBuffer();

  return {
    buffer,
    mimeType: TYPE.mimeType,
    extension: TYPE.extension,
    fileName:
      `${stripBrokenBar(
        docModel.fileName ||
        "document"
      )}.${TYPE.extension}`
  };
}

module.exports = exportExcel;