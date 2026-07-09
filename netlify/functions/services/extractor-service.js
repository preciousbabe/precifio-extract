// netlify/functions/services/extractor-service.js

const { extractPDF } = require('../processors/extract-pdf');
const { extractImage } = require('../processors/extract-image');
const { extractDOCX } = require('../processors/extract-docx');
const { extractXLSX } = require('../processors/extract-xlsx');
const { extractHTML } = require('../processors/extract-html');
const { extractText } = require('../processors/extract-text');

async function extractTextFromFile(file) {
  let mime = file.type || inferMimeType(file.name);

  console.log("================================");
  console.log("Extracting file:", file.name);
  console.log("Mime:", mime);
  console.log("Size:", file.size);
  console.log("================================");

  // ZIP files should NOT be processed here — they go to extract-zip endpoint
  if (mime === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
    throw new Error(
      'ZIP files must be uploaded via the ZIP extraction endpoint. ' +
      'Use the queue system or call /extract-zip directly.'
    );
  }

  if (mime === 'application/pdf') {
    console.log("-> Using PDF extractor");
    return extractPDF(file);
  }

  if (mime.startsWith('image/')) {
    console.log("-> Using IMAGE extractor");
    return extractImage(file);
  }

  if (
    mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    console.log("-> Using DOCX extractor");
    return extractDOCX(file);
  }

  if (
    mime ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'text/csv'
  ) {
    console.log("-> Using XLSX extractor");
    return extractXLSX(file);
  }

  if (mime === 'text/html') {
    console.log("-> Using HTML extractor");
    return extractHTML(file);
  }

  console.log("-> Using TEXT extractor");
  return extractText(file);
}

function inferMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();

  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
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

  return map[ext] || 'text/plain';
}

module.exports = {
  extractTextFromFile,
  inferMimeType
};