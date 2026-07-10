// netlify/functions/extract-zip/extract-zip.js

const { validateUpload } = require('../utils/validate-upload');
const { extractArchive } = require('../processors/extract-archive');
const { processDocumentBatch } = require('../services/process-document-batch');
const { createClient } = require('@supabase/supabase-js');

function parseMultipart(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];

  if (!contentType || !contentType.includes('multipart/form-data')) {
    const body = JSON.parse(event.body || '{}');
    return { files: body.files || [] };
  }

  const multipart = require('parse-multipart');
  const boundary = contentType.split('boundary=')[1];
  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = multipart.Parse(body, boundary);

  return {
    files: parts.map(part => ({
      name: part.filename || 'unknown',
      buffer: part.data,
      size: part.data.length,
      type: part.type || inferMimeType(part.filename)
    }))
  };
}

function inferMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', html: 'text/html', txt: 'text/plain',
    zip: 'application/zip', 'x-zip-compressed': 'application/x-zip-compressed'
  };
  return map[ext] || 'application/octet-stream';
}

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
    console.log("========================================");
    console.log("ZIP EXTRACTION STARTED");
    console.log("========================================");

    const parsed = parseMultipart(event);
    const zipFile = parsed.files[0];

    if (!zipFile) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No ZIP uploaded" })
      };
    }

    //--------------------------------------------------------
    // Auth / Guest Check
    //--------------------------------------------------------

    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const guestId = event.headers['x-guest-id'] || null;

    let userId = null;
    let isGuest = true;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        isGuest = false;
      }
    }

    // Guest check for ZIP
    if (isGuest) {
      if (!guestId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Guest ID required',
            code: 'GUEST_ID_MISSING',
            isGuest: true
          })
        };
      }

      // Check guest extraction count
      const { data: guestRecord } = await supabase
        .from('guest_extractions')
        .select('extraction_count')
        .eq('guest_id', guestId)
        .maybeSingle();

      const extractionCount = guestRecord ? guestRecord.extraction_count : 0;

      if (extractionCount >= 1) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: 'Free extraction used. Sign up for more.',
            code: 'GUEST_LIMIT_REACHED',
            isGuest: true
          })
        };
      }

      // Record guest extraction
      if (guestRecord) {
        await supabase
          .from('guest_extractions')
          .update({ extraction_count: extractionCount + 1, last_used: new Date().toISOString() })
          .eq('guest_id', guestId);
      } else {
        await supabase
          .from('guest_extractions')
          .insert({
            guest_id: guestId,
            extraction_count: 1,
            first_used: new Date().toISOString(),
            last_used: new Date().toISOString()
          });
      }
    }

    //--------------------------------------------------------
    // Validate uploaded ZIP
    //--------------------------------------------------------

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

    //--------------------------------------------------------
    // Extract archive
    //--------------------------------------------------------

    const extractedFiles = await extractArchive(zipFile);

    const zipMetadata = {
      method: 'zip-extraction',
      totalEntries: extractedFiles.length,
      extractedFiles: extractedFiles.length
    };

    console.log("Files extracted:", extractedFiles.length);

    //--------------------------------------------------------
    // Validate extracted files
    //--------------------------------------------------------

    const validFiles = [];
    const validationErrors = [];

    for (let i = 0; i < extractedFiles.length; i++) {
      const file = extractedFiles[i];
      const result = validateUpload(file);

      if (result.valid) {
        validFiles.push({ ...file, validation: result });
        console.log("✓", file.name);
      } else {
        validationErrors.push({
          index: i,
          fileName: file.name,
          errors: result.errors
        });
        console.log("✗", file.name);
      }
    }

    //--------------------------------------------------------
    // Nothing usable
    //--------------------------------------------------------

    if (!validFiles.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          summary: {
            totalReceived: extractedFiles.length,
            processed: 0,
            failed: validationErrors.length
          },
          results: [],
          errors: validationErrors
        })
      };
    }

    //--------------------------------------------------------
    // Process all extracted files
    //--------------------------------------------------------

    const response = await processDocumentBatch(validFiles, { userId, isGuest });

    response.metadata = zipMetadata;
    if (!response.summary) response.summary = {};

    response.summary.totalReceived = extractedFiles.length;
    response.summary.processed = response.summary.processed || 0;
    response.summary.failed = (response.summary.failed || 0) + validationErrors.length;

    response.errors = [
      ...validationErrors,
      ...response.errors
    ];

    console.log("========================================");
    console.log("ZIP COMPLETE");
    console.log(response.summary);
    console.log("========================================");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...response,
        isGuest
      })
    };

  } catch (err) {
    console.error("ZIP ERROR");
    console.error(err);

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