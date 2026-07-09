// netlify/functions/utils/clean-ocr.js
// Minimal OCR artifact cleanup. No semantic changes, no data transformation.
// Only fixes obvious mechanical extraction errors.

function cleanOCR(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let cleaned = text;

  // Fix common OCR encoding issues
  cleaned = cleaned
    // Normalize punctuation
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/[\u201C\u201D"]/g, '"')
    .replace(/[\u2014\u2013]/g, '-')

    // Remove invisible characters
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\uFEFF/g, '')

    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

    // Fix broken currency symbols
    .replace(/\$\s*/g, '$')
    .replace(/\u20AC\s*/g, '\u20AC')
    .replace(/\u00A3\s*/g, '\u00A3')

    // Fix broken number formatting
    .replace(/(\d)\s*,\s*(\d{3})/g, '$1,$2')
    .replace(/(\d)\s*\.\s*(\d+)/g, '$1.$2')

    // Collapse whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  // Remove OCR artifact lines
  const lines = cleaned.split('\n');

  const filtered = lines.filter(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      return false;
    }

    // Skip repeated punctuation artifacts
    if (/^[.\-_]{5,}$/.test(trimmed)) {
      return false;
    }

    // Skip invisible-character-only lines
    if (/^[\s\u00A0\u200B]+$/.test(trimmed)) {
      return false;
    }

    return true;
  });

  return filtered.join('\n').trim();
}

module.exports = {
  cleanOCR
};