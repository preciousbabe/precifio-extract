// netlify/function/extract/extract.js
const config = require('../../../config');
const { validateUpload } = require('../utils/validate-upload');
const { extractTextFromFile } = require('../services/extractor-service');
const { cleanOCR } = require('../utils/clean-ocr');
const AIClient = require('../utils/ai-client');
const { createClient } = require('@supabase/supabase-js');
const parseMultipartLib = require('parse-multipart');

function parseMultipart(event) {
  const contentType = event.headers['content-type'] || event.headers['Content-Type'];

  if (!contentType || !contentType.includes('multipart/form-data')) {
    const body = JSON.parse(event.body || '{}');
    return { files: body.files || [] };
  }

  const boundary = contentType.split('boundary=')[1];
  const body = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
  const parts = parseMultipartLib.Parse(body, boundary);

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
    zip: 'application/zip'
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Calculate cost in CREDITS based on estimated page count.
 * 1 credit = 1 page (~500 words or ~750 tokens).
 * No charge for failed extractions — credits only deducted on success.
 */
function calculatePageCost(extraction) {
  const text = extraction.text || '';
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  // Estimate pages: ~500 words per page, minimum 1 page
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 500));
  
  // Cap at 50 pages to prevent abuse on huge files
  return Math.min(estimatedPages, 50);
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

    // Fire-and-forget cleanup of guest records older than 30 days
    supabase
      .from('guest_extractions')
      .delete()
      .lt('last_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .then(() => console.log('Cleaned up guest records older than 30 days'))
      .catch(err => console.error('Cleanup failed:', err.message));

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        isGuest = false;
      }
    }

    // Guest tracking — check limit and expiry
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

      const { data: guestRecord } = await supabase
        .from('guest_extractions')
        .select('extraction_count, first_used')
        .eq('guest_id', guestId)
        .maybeSingle();

      const extractionCount = guestRecord ? guestRecord.extraction_count : 0;

      // Check 30-day expiry
      const daysActive = guestRecord 
        ? (Date.now() - new Date(guestRecord.first_used).getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      if (daysActive > 30 && extractionCount > 0) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: 'Guest session expired (30 days). Please sign up to continue.',
            code: 'GUEST_EXPIRED',
            isGuest: true,
            daysActive: Math.floor(daysActive)
          })
        };
      }

      // Guest limit: 1 free extraction
      if (extractionCount >= 1) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: 'Free extraction used (1/1). Sign up for more.',
            code: 'GUEST_LIMIT_REACHED',
            isGuest: true,
            extractionCount,
            limit: 1
          })
        };
      }

      // Record or increment guest extraction
      if (guestRecord) {
        await supabase
          .from('guest_extractions')
          .update({ 
            extraction_count: extractionCount + 1, 
            last_used: new Date().toISOString() 
          })
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
    // Extract text (NO charge yet — we check credits first)
    //--------------------------------------------------------

    const extraction = await extractTextFromFile(file);

    let finalText = extraction.text;
    let extractionMethod = extraction.metadata.method;

    //--------------------------------------------------------
    // Clean and validate text
    //--------------------------------------------------------

    const cleanedText = cleanOCR(finalText || '');

    if (!cleanedText || cleanedText.length < 10) {
      // NO charge for failed extraction
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

    // Calculate cost in pages/credits
    const cost = calculatePageCost({ text: cleanedText });

    //--------------------------------------------------------
    // Credit Check & Deduction (Authenticated users only)
    //--------------------------------------------------------

    if (!isGuest && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', userId)
        .single();

      const currentCredits = profile ? profile.credits_remaining : 0;

      if (currentCredits < cost) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: 'Insufficient credits',
            code: 'INSUFFICIENT_CREDITS',
            required: cost,
            available: currentCredits,
            isGuest: false,
            message: `This document costs ${cost} credit${cost > 1 ? 's' : ''}. You have ${currentCredits} remaining.`
          })
        };
      }

      // Deduct credits BEFORE AI call (refund if AI fails)
      const newBalance = currentCredits - cost;
      
      await supabase
        .from('profiles')
        .update({ credits_remaining: newBalance })
        .eq('id', userId);

      // Log pre-deduction transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -cost,
        type: 'extraction',
        balance_after: newBalance,
        metadata: {
          file_name: file.name,
          pages: cost,
          words: cleanedText.split(/\s+/).filter(w => w.length > 0).length,
          model: config.ai.provider,
          status: 'pending'
        }
      });

      console.log(`Reserved ${cost} credits from user ${userId}. Balance: ${newBalance}`);
    }

    //--------------------------------------------------------
    // AI extraction
    //--------------------------------------------------------

    let extractedData;
    try {
      const aiClient = new AIClient();
      extractedData = await aiClient.extract(cleanedText);
    } catch (aiError) {
      // AI failed — REFUND credits if authenticated
      if (!isGuest && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credits_remaining')
          .eq('id', userId)
          .single();
        
        const refundedBalance = (profile?.credits_remaining || 0) + cost;
        
        await supabase
          .from('profiles')
          .update({ credits_remaining: refundedBalance })
          .eq('id', userId);

        await supabase.from('credit_transactions').insert({
          user_id: userId,
          amount: cost,
          type: 'refund',
          balance_after: refundedBalance,
          metadata: {
            file_name: file.name,
            pages: cost,
            reason: 'ai_extraction_failed',
            error: aiError.message
          }
        });

        console.log(`Refunded ${cost} credits to user ${userId} due to AI error. Balance: ${refundedBalance}`);
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'AI extraction failed',
          message: aiError.message,
          refunded: !isGuest
        })
      };
    }

    // Update transaction to completed
    if (!isGuest && userId) {
      await supabase
        .from('credit_transactions')
        .update({ 
          metadata: {
            file_name: file.name,
            pages: cost,
            words: cleanedText.split(/\s+/).filter(w => w.length > 0).length,
            model: config.ai.provider,
            status: 'completed'
          }
        })
        .eq('user_id', userId)
        .eq('type', 'extraction')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isGuest,
        fileName: file.name,
        fileType: validation.mimeType,
        documentSummary: extractedData.document_summary,
        segments: extractedData.segments,
        metadata: {
          extraction: {
            ...extraction.metadata,
            finalMethod: extractionMethod,
            textLength: cleanedText.length,
            wordCount: cleanedText.split(/\s+/).filter(w => w.length > 0).length,
            estimatedPages: cost
          },
          aiProvider: config.ai.provider,
          creditsUsed: isGuest ? 0 : cost
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