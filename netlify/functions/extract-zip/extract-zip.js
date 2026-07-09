// netlify/functions/extract-zip/extract-zip.js — SIMPLIFIED

const { validateUpload } = require('../utils/validate-upload');
const { extractArchive } = require('../processors/extract-archive');

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const parsed = parseMultipart(event);
    const zipFile = parsed.files[0];

    if (!zipFile) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No ZIP uploaded" })
      };
    }

    const validation = validateUpload(zipFile);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Validation failed",
          details: validation.errors
        })
      };
    }

    console.log("ZIP:", zipFile.name);

    // Extract only — NO AI processing
    const extractedFiles = await extractArchive(zipFile);

    const validFiles = [];
    const validationErrors = [];

    for (const file of extractedFiles) {
      const result = validateUpload(file);
      if (result.valid) {
        validFiles.push({
          name: file.name,
          type: file.type || inferMimeType(file.name),
          size: file.size
        });
      } else {
        validationErrors.push({
          fileName: file.name,
          errors: result.errors
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isZipExtraction: true,
        zipName: zipFile.name,
        extractedFiles: validFiles,
        extractedCount: validFiles.length,
        validationErrors,
        message: `${validFiles.length} files extracted. They will be added to your queue for processing.`
      })
    };

  } catch (err) {
    console.error("ZIP ERROR:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};

// ... keep parseMultipart and inferMimeType ...

function parseMultipart(event) {

  const contentType =
    event.headers["content-type"] ||
    event.headers["Content-Type"];

  if (
    !contentType ||
    !contentType.includes("multipart/form-data")
  ) {

    const body = JSON.parse(event.body || "{}");

    return {
      files: body.files || []
    };
  }

  const multipart = require("parse-multipart");

  const boundary =
    contentType.split("boundary=")[1];

  const body = Buffer.from(
    event.body,
    event.isBase64Encoded
      ? "base64"
      : "utf8"
  );

  const parts =
    multipart.Parse(body, boundary);

  return {
    files: parts.map(part => ({
      name: part.filename || "unknown",
      buffer: part.data,
      size: part.data.length,
      type:
        part.type ||
        inferMimeType(part.filename)
    }))
  };
}

function inferMimeType(filename) {

  const ext =
    filename.split(".").pop().toLowerCase();

  const map = {

    pdf: "application/pdf",

    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",

    docx:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    xlsx:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    csv: "text/csv",

    html: "text/html",

    txt: "text/plain",

    zip: "application/zip",

    "x-zip-compressed":
      "application/x-zip-compressed"
  };

  return (
    map[ext] ||
    "application/octet-stream"
  );
}