// netlify/functions/extract/extract.js
const config = require("../../../config");
const { validateUpload } = require("../utils/validate-upload");
const { extractTextFromFile } = require("../services/extractor-service");
const { cleanOCR } = require("../utils/clean-ocr");
const AIClient = require("../utils/ai-client");
const { createClient } = require("@supabase/supabase-js");
const parseMultipartLib = require("parse-multipart");
const crypto = require("crypto");

function parseMultipart(event) {
  const contentType = event.headers["content-type"] || event.headers["Content-Type"];

  if (!contentType || !contentType.includes("multipart/form-data")) {
    const body = JSON.parse(event.body || "{}");
    return { files: body.files || [] };
  }

  const boundary = contentType.split("boundary=")[1];
  const body = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
  const parts = parseMultipartLib.Parse(body, boundary);

  return {
    files: parts.map((part) => ({
      name: part.filename || "unknown",
      buffer: part.data,
      size: part.data.length,
      type: part.type || inferMimeType(part.filename),
    })),
  };
}

function inferMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    html: "text/html",
    txt: "text/plain",
    zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

function estimateCreditCost(text, fileName = '') {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const charCount = text.length;
  let estimated = Math.max(0.5, wordCount / 400);

  const lowerName = fileName.toLowerCase();
  if (/bank|statement/.test(lowerName)) estimated *= 2.5;
  else if (/invoice|bill/.test(lowerName)) estimated *= 1.2;
  else if (/receipt/.test(lowerName)) estimated *= 0.8;

  const numberDensity = charCount > 0 ? (text.match(/\d/g) || []).length / charCount : 0;
  if (numberDensity > 0.15) estimated *= 1.3;

  return Math.ceil(estimated * 2) / 2; // round to nearest 0.5
}

function calculateActualCost(documentType, textLength = 0) {
  const rates = {
    receipt: 0.7, invoice: 1.2, purchase_order: 1.6,
    bank_statement: 4.8, insurance_claim: 7.2,
    medical_report: 8.5, passport: 0.9, drivers_license: 0.8,
    generic: 1.0
  };
  const rate = rates[documentType] || rates.generic;
  // Token proxy: 1 token ≈ 4 chars
  const tokenCost = (textLength / 4 / 1000) * 0.5;
  return Math.round(Math.max(rate, Math.min(tokenCost, rate * 1.5)) * 10) / 10;
}

function applyCorrections(extractedData, corrections) {
  if (!extractedData.segments) return extractedData;

  extractedData.segments.forEach((seg) => {
    (seg.fields || []).forEach((field, fieldIdx) => {
      const key = `${seg.segment_name}.${field.label}`;

      if (corrections[key]) {
        if (corrections[key].action === "delete") {
          field._deleted = true;
        } else {
          field.value = corrections[key].to;
        }
      }

      const labelKey = `${key}._label`;
      if (corrections[labelKey]) {
        if (corrections[labelKey].action === "delete") {
          field._deleted = true;
        } else {
          field.label = corrections[labelKey].to;
        }
      }
    });

    // Remove deleted fields before normalization runs
    seg.fields = (seg.fields || []).filter((f) => !f._deleted);
  });

  return extractedData;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

    let transactionId = null;
    let newBalance = null;

  
  try {
    const extractionId = crypto.randomUUID();
    const parsed = parseMultipart(event);
    const file = parsed.files[0];

    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No file uploaded" }),
      };
    }

    const validation = validateUpload(file);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "Validation failed",
          details: validation.errors,
        }),
      };
    }

    // Auth / Guest
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;
    const guestId = event.headers["x-guest-id"] || null;

    let userId = null;
    let isGuest = true;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Cleanup old guests
    supabase
      .from("guest_extractions")
      .delete()
      .lt("last_used", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .then(() => console.log("Cleaned up guest records older than 30 days"))
      .catch((err) => console.error("Cleanup failed:", err.message));

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        isGuest = false;
      }
    }

    
    
        // ── Idempotency key: file hash + user/guest ──
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(file.buffer.toString('base64').slice(0, 8000) + (userId || guestId || 'guest'))
      .digest('hex');

    // Check for recent completed extraction (retry path)
    const { data: cachedJob } = await supabase
      .from('extractions')
      .select('id, status, raw_result, actual_cost, estimated_cost, created_at')
      .eq('idempotency_key', idempotencyKey)
      .gt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedJob?.status === 'completed' && cachedJob.raw_result) {
      // Fast path: skip AI entirely
      const extractedData = cachedJob.raw_result;
      const docType = (extractedData.document_type || extractedData.category || 'generic').toString().toLowerCase().trim();
      
      let rawSegments = normalizeSegments(Array.isArray(extractedData.segments) ? extractedData.segments : []);
      const originalSegments = JSON.parse(JSON.stringify(rawSegments));
      
      // Note: skip pattern re-apply on cache hit to avoid needing documentFingerprint here
      // (Patterns were already applied when the job first completed)

            let currentBalance = null;
      if (!isGuest && userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_remaining")
          .eq("id", userId)
          .single();
        currentBalance = profile?.credits_remaining ?? null;
      }

       // Only charge guest when they actually receive a result
      if (isGuest && guestId) {
        await supabase
          .from("guest_extractions")
          .update({ extraction_count: 1, last_used: new Date().toISOString() })
          .eq("guest_id", guestId);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          extractionId: cachedJob.id,
          isGuest,
          fileName: file.name,
          fileType: validation.mimeType,
          documentSummary: extractedData.document_summary,
          documentType: docType,
          originalSegments,
          segments: extractedData.segments,
          cached: true,
          metadata: {
            patternVersion: 1,
            processedAt: new Date().toISOString(),
                      extraction: {
            finalMethod: 'cached',
            textLength: 0,
            wordCount: 0,
            estimatedPages: cachedJob.estimated_cost,
          },
            creditsUsed: isGuest ? 0 : cachedJob.actual_cost,
           newBalance: isGuest ? null : currentBalance,
          },
        }),
      };
    }

    // If a job is still processing from a recent attempt, tell client to poll
    if (cachedJob?.status === 'processing' && 
        Date.now() - new Date(cachedJob.created_at).getTime() < 2 * 60 * 1000) {
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({
          status: 'processing',
          jobId: cachedJob.id,
          message: 'Extraction in progress. Please poll for results.',
          retryAfter: 3,
        }),
      };
    }
    // ──────────────────────────────────────────────


           // Guest tracking with IP rate limit
    if (isGuest) {
      if (!guestId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: "Guest ID required",
            code: "GUEST_ID_MISSING",
            isGuest: true,
          }),
        };
      }

      const clientIp = event.headers['x-nf-client-connection-ip'] || 
                       event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                       'unknown';

      // Hard limit: 3 per IP ever
      const { data: ipCheck } = await supabase
        .from("guest_extractions")
        .select("extraction_count")
        .eq("ip_address", clientIp)
        .maybeSingle();

      if (ipCheck && ipCheck.extraction_count >= 3) {
        return {
          statusCode: 429,
          headers,
          body: JSON.stringify({
            error: "Free extraction limit reached for this network. Please sign up to continue.",
            code: "GUEST_IP_LIMIT_REACHED",
            isGuest: true,
          }),
        };
      }

      const { data: guestRecord } = await supabase
        .from("guest_extractions")
        .select("extraction_count, first_used")
        .eq("guest_id", guestId)
        .maybeSingle();

      const extractionCount = guestRecord ? guestRecord.extraction_count : 0;
      const daysActive = guestRecord
        ? (Date.now() - new Date(guestRecord.first_used).getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      if (daysActive > 30 && extractionCount > 0) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: "Guest session expired (30 days). Please sign up to continue.",
            code: "GUEST_EXPIRED",
            isGuest: true,
          }),
        };
      }

      if (extractionCount >= 1) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: "Free extraction used (1/1). Sign up for more.",
            code: "GUEST_LIMIT_REACHED",
            isGuest: true,
          }),
        };
      }

            // Ensure record exists with count 0, but don't charge yet
      if (!guestRecord) {
        await supabase.from("guest_extractions").insert({
          guest_id: guestId,
          ip_address: clientIp,
          extraction_count: 0,
          first_used: new Date().toISOString(),
          last_used: new Date().toISOString(),
        });
      }
    }

    // Extract text
    const extraction = await extractTextFromFile(file);
    let finalText = extraction.text;
    let extractionMethod = extraction.metadata.method;
    const cleanedText = cleanOCR(finalText || "");
   
  const fingerprintSource = cleanedText
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

  const documentFingerprint = crypto
  .createHash("sha256")
  .update(fingerprintSource.substring(0, 5000))
  .digest("hex");

    if (!cleanedText || cleanedText.length < 10) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: "Could not extract readable text from document",
          metadata: {
            ...extraction.metadata,
            attemptedOCR: extractionMethod === "ocr-fallback",
          },
        }),
      };
    }


    const cost = estimateCreditCost(cleanedText, file.name);

            // ── Create extraction job record BEFORE slow AI call ──
      const { data: jobRecord } = await supabase.from('extractions').insert({
      id: extractionId,
      idempotency_key: idempotencyKey,
      user_id: userId || null,
      guest_id: isGuest ? guestId : null,
      document_type: 'unknown',
      file_name: file.name,
      estimated_cost: cost,
      actual_cost: 0,
      tokens_approx: Math.ceil(cleanedText.length / 4),
      status: 'processing',
      ocr_text: cleanedText.substring(0, 5000), // truncated for storage
      created_at: new Date().toISOString()
    }).select('id').single();
    // ────────────────────────────────────────────────────

        // ── Credit expiration: bonus credits die after 90 days ──
    if (!isGuest && userId) {
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("created_at, credits_remaining")
        .eq("id", userId)
        .single();

      const { data: hasPurchased } = await supabase
        .from("credit_transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "purchase")
        .limit(1);

      const accountAgeDays = (Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60 * 24);

      // If never purchased and account > 90 days old, bonus credits are dead
      if (!hasPurchased?.length && accountAgeDays > 90 && userProfile.credits_remaining > 0) {
        await supabase
          .from("profiles")
          .update({ credits_remaining: 0 })
          .eq("id", userId);

        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount: -userProfile.credits_remaining,
          type: "expiry",
          balance_after: 0,
          status: "completed",
          metadata: { reason: "signup_bonus_expired", account_age_days: Math.floor(accountAgeDays) }
        });

        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: "Your welcome credits have expired after 90 days. Purchase credits to continue.",
            code: "BONUS_EXPIRED",
            expiredAmount: userProfile.credits_remaining,
          }),
        };
      }
    }
    // ────────────────────────────────────────────────────────

    // Credit check & deduction
    if (!isGuest && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userId)
        .single();

      const currentCredits = profile ? profile.credits_remaining : 0;

      if (currentCredits < cost) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            required: cost,
            available: currentCredits,
            isGuest: false,
            message: `This document costs ${cost} credit${cost > 1 ? "s" : ""}. You have ${currentCredits} remaining.`,
          }),
        };
      }

      newBalance = currentCredits - cost;
      await supabase.from("profiles").update({ credits_remaining: newBalance }).eq("id", userId);

      const { data: txData, error: txError } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: userId,
          amount: -cost,
          type: "extraction",
          balance_after: newBalance,
          status: "pending",
          metadata: {
            file_name: file.name,
            pages: cost,
            words: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
            model: config.ai.provider,
            chars: cleanedText.length,
          },
        })
        .select("id")
        .single();

      if (txError) {
        console.error("Failed to log extraction transaction:", txError);
      } else {
        transactionId = txData?.id;
      }

      console.log(`Reserved ${cost} credits from user ${userId}. Balance: ${newBalance}`);
    }


    let savedPattern = null;
let patternApplied = false;

if (!isGuest && userId) {
  const { data: patterns } = await supabase
    .from("extraction_patterns")
    .select("*")
    .eq("user_id", userId)
    .eq("document_fingerprint", documentFingerprint)
    .order("last_used_at", { ascending: false })
    .limit(1);

  if (patterns && patterns.length > 0) {
    savedPattern = patterns[0];
    patternApplied = true;
    
    // Update usage stats
    await supabase
      .from("extraction_patterns")
      .update({ 
        usage_count: patterns[0].usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq("id", patterns[0].id);
  }
}

    // AI extraction
    let extractedData;
    let docType = 'generic';
    let actualCost = cost; 

    try {
      const aiClient = new AIClient();
      extractedData = await aiClient.extract(cleanedText);

          // ── Credit true-up after successful extraction ──
      docType = (extractedData.document_type || extractedData.category || 'generic').toString().toLowerCase().trim();
    actualCost = calculateActualCost(docType, cleanedText.length);
    const refundAmount = Math.round((cost - actualCost) * 10) / 10;

    
    // Refund difference if we over-estimated (generosity mechanic)
    if (!isGuest && userId && refundAmount > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userId)
        .single();

      const refundedBalance = (profile?.credits_remaining || 0) + refundAmount;
      await supabase.from("profiles").update({ credits_remaining: refundedBalance }).eq("id", userId);

      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: refundAmount,
        type: "refund",
        balance_after: refundedBalance,
        status: "completed",
        metadata: {
          reason: "actual_cost_lower_than_estimate",
          estimated: cost,
          actual: actualCost,
          file_name: file.name,
          document_type: docType,
        },
      });

      newBalance = refundedBalance;
    }

      
    // ── Save raw result IMMEDIATELY (before Netlify can timeout) ──
    await supabase.from('extractions').update({
      status: 'completed',
      raw_result: extractedData,
      document_type: (extractedData.document_type || extractedData.category || 'generic').toString().toLowerCase().trim(),
      actual_cost: actualCost,
    }).eq('id', extractionId);
    // ─────────────────────────────────────────────────────────────

     } catch (aiError) {
      if (!isGuest && userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_remaining")
          .eq("id", userId)
          .single();

        const refundedBalance = (profile?.credits_remaining || 0) + cost;
        await supabase.from("profiles").update({ credits_remaining: refundedBalance }).eq("id", userId);

        await supabase.from("credit_transactions").insert({
          user_id: userId,
          amount: cost,
          type: "refund",
          balance_after: refundedBalance,
          status: "completed",
          metadata: {
            file_name: file.name,
            pages: cost,
            reason: "ai_extraction_failed",
            error: aiError.message,
          },
        });

                if (transactionId) {
          await supabase.from("credit_transactions").update({ status: "failed" }).eq("id", transactionId);
        }

                // ── Mark extraction as failed ──
                try {
          await supabase.from('extractions').update({
            status: 'failed',
            error_message: aiError.message,
            actual_cost: 0,
          }).eq('id', extractionId);
        } catch (e) {
          // Silent fail — don't block the refund response
        }
        // ───────────────────────────────

        console.log(`Refunded ${cost} credits to user ${userId} due to AI error. Balance: ${refundedBalance}`);
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "AI extraction failed",
          message: aiError.message,
          refunded: !isGuest,
        }),
      };
    }



        // 1. Normalize the RAW AI output FIRST (before any corrections)
    const rawSegments = normalizeSegments(Array.isArray(extractedData.segments) ? extractedData.segments : []);
    const originalSegments = JSON.parse(JSON.stringify(rawSegments));

        // ── Fallback: exact fingerprint missed → try document type ──
    if (!isGuest && userId && !savedPattern) {
      const docType = (extractedData.document_type || extractedData.category || "unknown")
        .toString()
        .toLowerCase()
        .trim();

      const { data: typePatterns } = await supabase
        .from("extraction_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("document_type", docType)
        .order("last_used_at", { ascending: false })
        .limit(1);

      if (typePatterns && typePatterns.length > 0) {
        savedPattern = typePatterns[0];
        patternApplied = true;

        await supabase
          .from("extraction_patterns")
          .update({
            usage_count: typePatterns[0].usage_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", typePatterns[0].id);
      }
    }

    // 2. Apply saved pattern corrections to a fresh copy for display/export
    extractedData.segments = JSON.parse(JSON.stringify(rawSegments));
    if (savedPattern && savedPattern.corrections) {
      extractedData = applyCorrections(extractedData, savedPattern.corrections);
    }
    const segments = extractedData.segments;

        if (!isGuest && userId && transactionId) {
      const { error: updateError } = await supabase
        .from("credit_transactions")
        .update({
          status: "completed",
          metadata: {
            file_name: file.name,
            estimated_cost: cost,
            actual_cost: actualCost,
            document_type: docType,
            words: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
            model: config.ai.provider,
            chars: cleanedText.length,
          }
        })
        .eq("id", transactionId);

      if (updateError) {
        console.error("Failed to update transaction status:", updateError);
      }
    }

        // Charge guest only after successful extraction
    if (isGuest && guestId) {
      await supabase
        .from("guest_extractions")
        .update({ extraction_count: 1, last_used: new Date().toISOString() })
        .eq("guest_id", guestId);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        extractionId,
        isGuest,
        fileName: file.name,
        fileType: validation.mimeType,
        documentSummary: extractedData.document_summary,
       documentType:
     (
       extractedData.document_type ||
       extractedData.category ||
       "unknown"
     )
     .toString()
     .toLowerCase()
     .trim(),
        originalSegments,
        segments,
        savedPattern,
        metadata: {
          documentFingerprint,
           patternVersion: 1,
           processedAt: new Date().toISOString(),
          extraction: {
            ...extraction.metadata,
            finalMethod: extractionMethod,
            originalMethod: extraction.metadata.method,
            textLength: cleanedText.length,
            wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
            estimatedPages: cost,
          },
          creditsUsed: isGuest ? 0 : cost,
          newBalance: isGuest ? null : newBalance,
        },
      }),
    };
  } catch (err) {
    console.error("Extract handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Extraction failed",
        message: err.message,
      }),
    };
  }
};

/**
 * Normalize segments so line items render as tables.
 * If a segment has fields where each value is an object with the same keys,
 * keep it as-is. If values are flat strings/numbers, leave them as primitives.
 */
function normalizeSegments(segments) {
  return segments.map((seg) => {
    const fields = seg.fields || [];

    // Detect line items: all values are objects with identical keys
    const objectFields = fields.filter(
      (f) => f.value && typeof f.value === "object" && !Array.isArray(f.value)
    );

    if (objectFields.length === fields.length && fields.length > 1) {
      // Already structured as objects — perfect for table rendering
      return seg;
    }

    // For flat string values, check if segment name suggests tabular data
    const tableKeywords = /line|item|product|entry|detail|row/i;
    if (tableKeywords.test(seg.segment_name) && fields.length > 1) {
      // Try to parse each field value into structured object
      const normalizedFields = fields.map((f) => ({
        ...f,
        value: tryParseStructured(f.value, f.label),
      }));
      return { ...seg, fields: normalizedFields };
    }

    // For non-tabular segments, unwrap { value: "string" } back to primitive
    const cleanedFields = fields.map((f) => {
      if (f.value && typeof f.value === "object" && !Array.isArray(f.value)) {
        const keys = Object.keys(f.value);
        // If it's just { value: "something" }, unwrap it
        if (keys.length === 1 && keys[0] === "value") {
          return { ...f, value: f.value.value };
        }
      }
      return f;
    });

    return { ...seg, fields: cleanedFields };
  });
}

/**
 * Try to parse a flat string into a structured object.
 * Returns primitive if not structured, or object if structured.
 */
function tryParseStructured(value, label) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return String(value);

  const lines = value.split(/\n|\r/).filter((l) => l.trim());
  const obj = {};
  let hasStructured = false;

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
      obj[key] = match[2].trim();
      hasStructured = true;
    }
  }

  return hasStructured ? obj : value; 
}