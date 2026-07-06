import * as XLSX from 'xlsx';
import { generateFileName } from '../utils/fileName';

/**
 * ============================================================
 * Precifio Extract
 * Universal Excel Downloader
 * ============================================================
 */

function saveWorkbook(workbook, filename) {
  XLSX.writeFile(workbook, filename);
}

function prettify(key = '') {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function isPrimitive(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value !== 'object'
  );
}

export function downloadAsExcel(extraction) {
  if (!extraction) {
    throw new Error('Nothing to download.');
  }

  const workbook = XLSX.utils.book_new();

  /**
   * ======================================================
   * SUMMARY SHEET
   * ======================================================
   */

  const summary = [];

  Object.entries(extraction).forEach(([key, value]) => {
    if (isPrimitive(value)) {
      summary.push({
        Field: prettify(key),
        Value: value
      });
    }
  });

  const summarySheet = XLSX.utils.json_to_sheet(summary);

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    'Summary'
  );

  /**
   * ======================================================
   * ARRAYS
   * ======================================================
   */

  Object.entries(extraction).forEach(([key, value]) => {
    if (
      Array.isArray(value) &&
      value.length &&
      typeof value[0] === 'object'
    ) {
      const sheet = XLSX.utils.json_to_sheet(value);

      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        prettify(key).substring(0, 31)
      );
    }
  });

  /**
   * ======================================================
   * NESTED OBJECTS
   * ======================================================
   */

  Object.entries(extraction).forEach(([key, value]) => {
    if (
      value &&
      !Array.isArray(value) &&
      typeof value === 'object'
    ) {
      const rows = Object.entries(value).map(
        ([k, v]) => ({
          Field: prettify(k),
          Value:
            typeof v === 'object'
              ? JSON.stringify(v)
              : v
        })
      );

      const sheet = XLSX.utils.json_to_sheet(rows);

      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        prettify(key).substring(0, 31)
      );
    }
  });

  /**
   * ======================================================
   * SAVE
   * ======================================================
   */

  saveWorkbook(
    workbook,
    generateFileName(extraction, 'xlsx')
  );
}