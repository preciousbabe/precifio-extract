// netlify/functions/utils/validate-upload.js
// Validates file uploads: type, size, empty check. Returns structured errors.

const config = require('../../../config');

function validateUpload(file) {
  const errors = [];

  if (!file) {
    return {
      valid: false,
      errors: ['No file provided']
    };
  }

  // Check file size
  if (file.size > config.maxFileSize) {
    errors.push(
      `File exceeds maximum size of ${
        config.maxFileSize / 1024 / 1024
      }MB`
    );
  }

  // Check empty file
  if (file.size === 0) {
    errors.push('File is empty');
  }

  // Check MIME type
  let mimeType = file.type || inferMimeType(file.name);

// Normalize equivalent ZIP MIME types
if (
  mimeType === 'application/x-zip-compressed' ||
  mimeType === 'application/x-zip'
) {
  mimeType = 'application/zip';
}

  if (!config.supportedMimeTypes.includes(mimeType)) {
    errors.push(
      `Unsupported file type: ${mimeType}. Supported: ${config.supportedMimeTypes.join(
        ', '
      )}`
    );
  }

  // Check for common corruption indicators
  if (
    file.buffer &&
    file.buffer.length < 100 &&
    file.size > 100
  ) {
    errors.push(
      'File buffer appears corrupted or truncated'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    mimeType,
    extension: getExtension(file.name)
  };
}

function inferMimeType(filename) {
  const ext = getExtension(filename).toLowerCase();

  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    bmp: 'image/bmp',
    webp: 'image/webp',
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

function getExtension(filename) {
  if (!filename) {
    return '';
  }

  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop() : '';
}

module.exports = {
  validateUpload,
  inferMimeType,
  getExtension
};