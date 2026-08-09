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

function getRequestedJobId(event) {
  const headerJobId =
    event.headers?.["x-extraction-job-id"] ||
    event.headers?.["X-Extraction-Job-Id"] ||
    null;

  if (headerJobId) return headerJobId;

  const queryJobId = event.queryStringParameters?.jobId || null;

  return queryJobId;
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

  return Math.ceil(estimated * 2) / 2;
}

function calculateActualCost(documentType, textLength = 0) {
  const rates = {
    receipt: 0.7, invoice: 1.2, purchase_order: 1.6,
    bank_statement: 4.8, insurance_claim: 7.2,
    medical_report: 8.5, passport: 0.9, drivers_license: 0.8,
    generic: 1.0
  };
  const rate = rates[documentType] || rates.generic;
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


const documentFingerprint = crypto
  .createHash("sha256")
  .update(file.buffer)
  .digest("hex");

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

    const requestedJobId = getRequestedJobId(event);

       // ── Idempotency key: file hash + user/guest ──
    const idempotencyKey = crypto
      .createHash("sha256")
      .update(
        file.buffer.toString("base64").slice(0, 8000) +
        (userId || guestId || "guest")
      )
      .digest("hex");
     let cachedJob = null;

    if (requestedJobId) {
      const { data: requestedJob, error: requestedJobError } =
        await supabase
          .from("extractions")
     .select(
     "id, status, raw_result, actual_cost, estimated_cost, created_at, updated_at, user_id, guest_id, file_name, file_type, document_type"
    )
          .eq("id", requestedJobId)
          .maybeSingle();

      if (requestedJobError) {
        console.error(
          "Requested job lookup failed:",
          requestedJobError.message
        );
      }

      if (requestedJob) {
        // Never allow one user's retry request to recover another
        // user's extraction.
        const belongsToCurrentUser =
          (!requestedJob.user_id && !userId) ||
          (requestedJob.user_id && requestedJob.user_id === userId) ||
          (requestedJob.guest_id && requestedJob.guest_id === guestId);

        if (belongsToCurrentUser) {
          cachedJob = requestedJob;
        }
      }
    }

    // ------------------------------------------------------------
    // IDEMPOTENCY RECOVERY
    // ------------------------------------------------------------
    //
    // If no explicit job ID was supplied, locate the latest job
    // created for the same file/user combination.
    //
    // We intentionally do NOT restrict this to 10 minutes.
    // The job itself is the durable recovery record.
    //
    if (!cachedJob) {
      const { data: existingJob, error: existingJobError } =
        await supabase
          .from("extractions")
          .select(
            "id, status, raw_result, actual_cost, estimated_cost, created_at, updated_at, user_id, guest_id, file_name, document_type"
          )
          .eq("idempotency_key", idempotencyKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (existingJobError) {
        console.error(
          "Idempotency job lookup failed:",
          existingJobError.message
        );
      }

      cachedJob = existingJob || null;
    }


if (cachedJob?.status === "completed" && cachedJob.raw_result) {
  const extractedData = JSON.parse(
    JSON.stringify(cachedJob.raw_result)
  );

  const docType = (
    extractedData.document_type ||
    extractedData.category ||
    cachedJob.document_type ||
    "generic"
  )
    .toString()
    .toLowerCase()
    .trim();

  // ------------------------------------------------------------
  // NORMALIZE THE ORIGINAL RAW EXTRACTION
  // ------------------------------------------------------------

  const rawSegments = normalizeSegments(
    Array.isArray(extractedData.segments)
      ? extractedData.segments
      : []
  );

  const originalSegments = JSON.parse(
    JSON.stringify(rawSegments)
  );

  // ------------------------------------------------------------
  // LOAD SAVED PATTERN
  // ------------------------------------------------------------

  let savedPattern = null;
  let patternApplied = false;

  if (!isGuest && userId) {
    const { data: patterns, error: patternError } =
      await supabase
        .from("extraction_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("document_fingerprint", documentFingerprint)
        .order("last_used_at", { ascending: false })
        .limit(1);

    if (patternError) {
      console.error(
        "Cached recovery pattern lookup failed:",
        patternError.message
      );
    }

    if (patterns && patterns.length > 0) {
      savedPattern = patterns[0];
      patternApplied = true;

      await supabase
        .from("extraction_patterns")
        .update({
          usage_count: (patterns[0].usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", patterns[0].id);
    }
  }

  // ------------------------------------------------------------
  // FALLBACK: DOCUMENT TYPE PATTERN
  // ------------------------------------------------------------

  if (!isGuest && userId && !savedPattern) {
    const { data: typePatterns, error: typePatternError } =
      await supabase
        .from("extraction_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("document_type", docType)
        .order("last_used_at", { ascending: false })
        .limit(1);

    if (typePatternError) {
      console.error(
        "Cached recovery document-type pattern lookup failed:",
        typePatternError.message
      );
    }

    if (typePatterns && typePatterns.length > 0) {
      savedPattern = typePatterns[0];
      patternApplied = true;

      await supabase
        .from("extraction_patterns")
        .update({
          usage_count: (typePatterns[0].usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", typePatterns[0].id);
    }
  }

  // ------------------------------------------------------------
  // APPLY SAVED CORRECTIONS
  // ------------------------------------------------------------

  extractedData.segments = JSON.parse(
    JSON.stringify(rawSegments)
  );

  if (savedPattern?.corrections) {
    applyCorrections(
      extractedData,
      savedPattern.corrections
    );
  }

  const segments = extractedData.segments;

  // ------------------------------------------------------------
  // CURRENT CREDIT BALANCE
  // ------------------------------------------------------------

  let currentBalance = null;

  if (!isGuest && userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining")
      .eq("id", userId)
      .single();

    currentBalance = profile?.credits_remaining ?? null;
  }

  if (isGuest && guestId) {
    await supabase
      .from("guest_extractions")
      .update({
        last_used: new Date().toISOString(),
      })
      .eq("guest_id", guestId);
  }

  console.log(
    `Recovering completed extraction ${cachedJob.id} without AI`,
    {
      patternApplied,
      patternId: savedPattern?.id || null,
    }
  );

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      status: "completed",

      jobId: cachedJob.id,
      extractionId: cachedJob.id,

      isGuest,

      fileName:
        cachedJob.file_name ||
        file.name,

      fileType:
        cachedJob.file_type ||
        validation.mimeType,

      documentSummary:
        extractedData.document_summary,

      documentType: docType,

      // IMPORTANT:
      // originalSegments remain the untouched extraction.
      originalSegments,

      // segments contain saved corrections.
      segments,

      // IMPORTANT FOR FRONTEND
      savedPattern,
      patternApplied,

      cached: true,
      recovered: true,

      metadata: {
        documentFingerprint,

        patternVersion: 1,

        processedAt:
          cachedJob.updated_at ||
          cachedJob.created_at ||
          new Date().toISOString(),

        extraction: {
          ...(extractedData.metadata?.extraction || {}),
          finalMethod: "cached",
          textLength:
            extractedData.metadata?.extraction?.textLength || 0,
          wordCount:
            extractedData.metadata?.extraction?.wordCount || 0,
          estimatedPages:
            cachedJob.estimated_cost || 0,
        },

        creditsUsed:
          isGuest
            ? 0
            : cachedJob.actual_cost || 0,

        newBalance:
          isGuest
            ? null
            : currentBalance,

        cached: true,
        recovered: true,
      },
    }),
  };
}
      
    if (cachedJob?.status === "processing") {
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({
          status: "processing",
          jobId: cachedJob.id,
          extractionId: cachedJob.id,
          message:
            "Extraction is already running. Continue polling this job.",
          retryAfter: 3,
          recovering: true,
        }),
      };
    }

    
    const extractionId =
      cachedJob?.id || crypto.randomUUID();

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

    // ── Credit check (read-only, fail fast) ──
    let currentBalance = null;
    if (!isGuest && userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("credits_remaining")
        .eq("id", userId)
        .single();

      currentBalance = profile ? profile.credits_remaining : 0;
      if (currentBalance < cost) {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            required: cost,
            available: currentBalance,
            isGuest: false,
            message: `This document costs ${cost} credit${cost > 1 ? "s" : ""}. You have ${currentBalance} remaining.`,
          }),
        };
      }
    }

    // ── Upsert job record (insert new OR reset stale row) ──
    if (cachedJob?.id) {
      await supabase.from('extractions') .update({
          status: "processing",
          document_type: "unknown",
          file_name: file.name,
          file_type: file.type || validation.mimeType || null,
          estimated_cost: cost,
          actual_cost: 0,
          tokens_approx: Math.ceil(cleanedText.length / 4),
          error_message: null,
          raw_result: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", extractionId);
    } else {
    await supabase.from("extractions").insert({
  id: extractionId,
  idempotency_key: idempotencyKey,
  user_id: userId || null,
  guest_id: isGuest ? guestId : null,
  document_type: "unknown",
  file_name: file.name,
  file_type: file.type || validation.mimeType || null,
  estimated_cost: cost,
  actual_cost: 0,
  tokens_approx: Math.ceil(cleanedText.length / 4),
  status: "processing",
  created_at: new Date().toISOString(),
});
    }

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

     // ------------------------------------------------------------
// ATOMIC CREDIT CHARGE
// ------------------------------------------------------------
//
// Credits are deducted inside Supabase using a database RPC.
// The RPC performs the balance check, deduction, transaction
// logging, and duplicate-charge protection atomically.
//
// This means:
//   • The extraction cannot be charged twice
//   • The balance cannot be incorrectly overwritten
//   • Concurrent requests cannot race each other
//   • A timeout/retry cannot create a second charge
// ------------------------------------------------------------

if (!isGuest && userId) {
  const words = cleanedText
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .length;

  const { data: chargeResult, error: chargeError } =
    await supabase.rpc("charge_extraction_credits", {
      p_user_id: userId,
      p_amount: actualCost,
      p_extraction_id: extractionId,
      p_file_name: file.name,
      p_estimated_cost: cost,
      p_document_type: docType,
      p_words: words,
      p_model: config.ai.provider,
      p_chars: cleanedText.length,
    });

  if (chargeError) {
    console.error(
      "Atomic credit charge failed:",
      chargeError.message
    );

    throw new Error(
      `Credit charge failed: ${chargeError.message}`
    );
  }

  newBalance = chargeResult?.new_balance ?? null;

  console.log(
    `Extraction ${extractionId}: atomic credit charge complete`,
    {
      actualCost,
      newBalance,
      alreadyCharged:
        chargeResult?.already_charged || false,
    }
  );
  }


    extractedData.metadata = {
  ...(extractedData.metadata || {}),
   documentFingerprint,
  extraction: {
    ...(extractedData.metadata?.extraction || {}),
    textLength: cleanedText.length,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
    finalMethod: extractionMethod,
  },
};


      const { error: completionSaveError } = await supabase
        .from("extractions")
        .update({
          status: "completed",
          raw_result: extractedData,
          document_type: docType,
          actual_cost: actualCost,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", extractionId);

      if (completionSaveError) {
        throw new Error(
          `Failed to save completed extraction: ${completionSaveError.message}`
        );
      }

      console.log(
        `Extraction ${extractionId} saved as completed.`
      );

    } catch (aiError) {
      // Mark extraction as failed — credits were NEVER deducted, so nothing to refund
      try {
        await supabase.from('extractions').update({
          status: 'failed',
          error_message: aiError.message,
          actual_cost: 0,
        }).eq('id', extractionId);
      } catch (e) {
        // Silent fail — don't block the error response
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "AI extraction failed",
          message: aiError.message,
          refunded: false,
        }),
      };
    }

    // 1. Normalize the RAW AI output FIRST
    const rawSegments = normalizeSegments(Array.isArray(extractedData.segments) ? extractedData.segments : []);
    const originalSegments = JSON.parse(JSON.stringify(rawSegments));

    // ── Saved pattern matching ──
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
        
        await supabase
          .from("extraction_patterns")
          .update({ 
            usage_count: patterns[0].usage_count + 1,
            last_used_at: new Date().toISOString()
          })
          .eq("id", patterns[0].id);
      }
    }

    // ── Fallback: exact fingerprint missed → try document type ──
    if (!isGuest && userId && !savedPattern) {
      const docTypeLookup = (extractedData.document_type || extractedData.category || "unknown")
        .toString()
        .toLowerCase()
        .trim();

      const { data: typePatterns } = await supabase
        .from("extraction_patterns")
        .select("*")
        .eq("user_id", userId)
        .eq("document_type", docTypeLookup)
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
        status: "completed",
        jobId: extractionId,
        extractionId,

        isGuest,
        fileName: file.name,
        fileType: validation.mimeType,
        documentSummary: extractedData.document_summary,
        documentType: (extractedData.document_type || extractedData.category || "unknown").toString().toLowerCase().trim(),
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
                    creditsUsed: isGuest ? 0 : actualCost,
          newBalance: isGuest ? null : newBalance,

          // Normal first-time extraction.
          cached: false,
          recovered: false,
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

function normalizeSegments(segments) {
  return segments.map((seg) => {
    const fields = seg.fields || [];
    const objectFields = fields.filter(
      (f) => f.value && typeof f.value === "object" && !Array.isArray(f.value)
    );

    if (objectFields.length === fields.length && fields.length > 1) {
      return seg;
    }

    const tableKeywords = /line|item|product|entry|detail|row/i;
    if (tableKeywords.test(seg.segment_name) && fields.length > 1) {
      const normalizedFields = fields.map((f) => ({
        ...f,
        value: tryParseStructured(f.value, f.label),
      }));
      return { ...seg, fields: normalizedFields };
    }

    const cleanedFields = fields.map((f) => {
      if (f.value && typeof f.value === "object" && !Array.isArray(f.value)) {
        const keys = Object.keys(f.value);
        if (keys.length === 1 && keys[0] === "value") {
          return { ...f, value: f.value.value };
        }
      }
      return f;
    });

    return { ...seg, fields: cleanedFields };
  });
}

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