import { generateFileName } from '../utils/fileName';

/**
 * ============================================================
 * Precifio Extract
 * JSON Downloader
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
 * Download extraction as formatted JSON
 */
export function downloadAsJSON(extraction) {
  if (!extraction) {
    throw new Error('Nothing to download.');
  }

  const json = JSON.stringify(extraction, null, 2);

  const blob = new Blob([json], {
    type: 'application/json'
  });

  downloadBlob(
    blob,
    generateFileName(extraction, 'json')
  );
}