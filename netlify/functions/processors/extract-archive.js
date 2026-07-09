// netlify/functions/processors/extract-archive.js
// ZIP processor.
// Responsibility:
//   • Extract supported files from a ZIP archive.
//   • Return file objects.
//   • No OCR.
//   • No AI.
//   • No text extraction.

const AdmZip = require('adm-zip');

const SKIP_EXTENSIONS = [
  'exe',
  'dll',
  'bin',
  'dat',
  'tmp'
];

async function extractArchive(file) {
  console.log('\n========== ZIP EXTRACTION ==========');

  const buffer =
    file.buffer ||
    Buffer.from(file.content, 'base64');

  const zip = new AdmZip(buffer);

  const entries = zip.getEntries();

  console.log('ZIP entries:', entries.length);

  const files = [];
  const skipped = [];

  for (const entry of entries) {
    if (entry.isDirectory) {
      console.log('Skipping directory:', entry.entryName);
      continue;
    }

    const name = entry.entryName;
    const extension = getExtension(name);

    if (SKIP_EXTENSIONS.includes(extension)) {
      console.log('Skipping unsupported:', name);

      skipped.push({
        name,
        reason: 'Unsupported file type'
      });

      continue;
    }

    const extractedFile = {
      name,
      buffer: entry.getData(),
      size: entry.header.size,
      type: inferMimeType(name)
    };

    console.log(
      `Extracted: ${name} (${extractedFile.type}) ${extractedFile.size} bytes`
    );

    files.push(extractedFile);
  }

  console.log('Files extracted:', files.length);
  console.log('Files skipped:', skipped.length);
  console.log('===============================\n');

return files;
}

function getExtension(filename) {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

function inferMimeType(filename) {
  const ext = getExtension(filename);

  const map = {
    pdf: 'application/pdf',

    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tif: 'image/tiff',
    tiff: 'image/tiff',

    docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    xlsx:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    csv: 'text/csv',

    html: 'text/html',
    htm: 'text/html',

    txt: 'text/plain',
    md: 'text/markdown',

    json: 'application/json',

    xml: 'text/xml',

    zip: 'application/zip'
  };

  return map[ext] || 'application/octet-stream';
}

module.exports = {
  extractArchive
};

