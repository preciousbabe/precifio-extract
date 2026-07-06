import { generateFileName } from '../utils/fileName';

/**
 * ============================================================
 * Precifio Extract
 * Universal CSV Downloader
 * ============================================================
 */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Convert nested object into flat rows
 */

function flatten(obj, prefix = '', rows = []) {
  if (obj === null || obj === undefined) return rows;

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      flatten(item, `${prefix}[${index}]`, rows);
    });

    return rows;
  }

  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      flatten(
        value,
        prefix ? `${prefix}.${key}` : key,
        rows
      );
    });

    return rows;
  }

  rows.push([prefix, obj]);

  return rows;
}

/**
 * Download CSV
 */

export function downloadAsCSV(extraction) {
  if (!extraction) {
    throw new Error('Nothing to download.');
  }

  const rows = flatten(extraction);

  const csv = [
    ['Field', 'Value'],
    ...rows
  ]
    .map(row =>
      row
        .map(value =>
          `"${String(value ?? '').replace(/"/g, '""')}"`
        )
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8'
  });

  downloadBlob(
    blob,
    generateFileName(extraction, 'csv')
  );
}