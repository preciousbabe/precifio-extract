// netlify/functions/extract/extract.js

const config = require('../../../config');
const { validateUpload } = require('../utils/validate-upload');
const { extractTextFromFile } = require('../services/extractor-service');
const { cleanOCR } = require('../utils/clean-ocr');
const AIClient = require('../utils/ai-client');
const Tesseract = require('tesseract.js');

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
    const file = parsed.files[0];

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' })
      };
    }

    const validation = validateUpload(file);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Validation failed',
          details: validation.errors
        })
      };
    }

    //--------------------------------------------------------
    // Extract text
    //--------------------------------------------------------

    const extraction = await extractTextFromFile(file);

    //--------------------------------------------------------
    // OCR Fallback for PDFs that failed to parse
    //--------------------------------------------------------

    let finalText = extraction.text;
    let extractionMethod = extraction.metadata.method;

    if (
      extraction.metadata.needsOCR ||
      extraction.metadata.ocrRequired ||
      !finalText ||
      finalText.trim().length < 10
    ) {
      console.log("-> Attempting OCR fallback...");

      try {
        const ocrResult = await Tesseract.recognize(
          file.buffer,
          'eng',
          { logger: m => m.status === 'recognizing text' && console.log(`OCR: ${Math.round(m.progress * 100)}%`) }
        );

        if (ocrResult.data.text && ocrResult.data.text.trim().length > 10) {
          finalText = ocrResult.data.text;
          extractionMethod = 'ocr-fallback';
          console.log("-> OCR fallback successful");
        } else {
          console.log("-> OCR fallback produced no text");
        }
      } catch (ocrErr) {
        console.error("-> OCR fallback failed:", ocrErr.message);
      }
    }

    //--------------------------------------------------------
    // Clean and validate text
    //--------------------------------------------------------

    const cleanedText = cleanOCR(finalText || '');

    if (!cleanedText || cleanedText.length < 10) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: 'Could not extract readable text from document',
          metadata: {
            ...extraction.metadata,
            attemptedOCR: extractionMethod === 'ocr-fallback'
          }
        })
      };
    }

    //--------------------------------------------------------
    // AI extraction
    //--------------------------------------------------------

    const aiClient = new AIClient();
    const extractedData = await aiClient.extract(cleanedText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        fileName: file.name,
        fileType: validation.mimeType,
        documentSummary: extractedData.document_summary,
        segments: extractedData.segments,
        metadata: {
          extraction: {
            ...extraction.metadata,
            finalMethod: extractionMethod,
            textLength: cleanedText.length
          },
          aiProvider: config.ai.provider
        }
      })
    };

  } catch (err) {
    console.error("Extract handler error:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Extraction failed',
        message: err.message
      })
    };
  }
};



function parseMultipart(event) {

  console.log("\n--- parseMultipart() ---");

  const contentType =
    event.headers['content-type'] ||
    event.headers['Content-Type'];

  console.log("Content-Type:", contentType);

  if (!contentType ||
      !contentType.includes('multipart/form-data')) {

    console.log("Using JSON body");

    const body = JSON.parse(event.body || '{}');

    return {
      files: body.files || []
    };
  }

  console.log("Using multipart parser");

  const multipart = require('parse-multipart');

  const boundary = contentType.split('boundary=')[1];

  console.log("Boundary:", boundary);

  const body = Buffer.from(
    event.body,
    event.isBase64Encoded ? 'base64' : 'utf8'
  );

  console.log("Body length:", body.length);

  const parts = multipart.Parse(body, boundary);

  console.log("Parts found:", parts.length);

  const files = parts.map(part => ({
    name: part.filename || 'unknown',
    buffer: part.data,
    size: part.data.length,
    type: part.type || inferMimeType(part.filename)
  }));

  console.log("Files parsed:", files.length);

  return { files };
}

function inferMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();

  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    html: 'text/html',
    txt: 'text/plain',
    zip: 'application/zip'
  };

  return map[ext] || 'application/octet-stream';
}