// netlify/functions/extract/extract.js
const config = require("../../../config");
const { validateUpload } = require("../utils/validate-upload");
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
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv", html: "text/html", txt: "text/plain", zip: "application/zip",
  };
  return map[ext] || "application/octet-stream";
}

function getRequestedJobId(event) {
  return event.headers?.["x-extraction-job-id"] || event.headers?.["X-Extraction-Job-Id"] || event.queryStringParameters?.jobId || null;
}

function estimateCreditCost(text, fileName = "") {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  let estimated = Math.max(0.5, wordCount / 400);
  const lowerName = fileName.toLowerCase();
  if (/bank|statement/.test(lowerName)) estimated *= 2.5;
  else if (/invoice|bill/.test(lowerName)) estimated *= 1.2;
  else if (/receipt/.test(lowerName)) estimated *= 0.8;
  const charCount = text.length;
  const numberDensity = charCount > 0 ? (text.match(/\d/g) || []).length / charCount : 0;
  if (numberDensity > 0.15) estimated *= 1.3;
  return Math.ceil(estimated * 2) / 2;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Extraction-Job-Id, X-Guest-Id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const parsed = parseMultipart(event);
    const file = parsed.files[0];
    if (!file) return { statusCode: 400, headers, body: JSON.stringify({ error: "No file uploaded" }) };

    const validation = validateUpload(file);
    if (!validation.valid) return { statusCode: 400, headers, body: JSON.stringify({ error: "Validation failed", details: validation.errors }) };

    const documentFingerprint = crypto.createHash("sha256").update(file.buffer).digest("hex");

    // ── Auth ──
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;
    const guestId = event.headers["x-guest-id"] || event.headers["X-Guest-Id"] || null;

    let userId = null;
    let isGuest = true;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) { userId = user.id; isGuest = false; }
    }

    let requestedJobId = getRequestedJobId(event);

    // ── Idempotency key ──
    const idempotencyKey = crypto.createHash("sha256").update(
      file.buffer.toString("base64").slice(0, 8000) + (userId || guestId || "guest")
    ).digest("hex");

        // ── Guest limits (fail fast) ──
    if (isGuest) {
      if (!guestId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Guest ID required", code: "GUEST_ID_MISSING", isGuest: true }) };
      }

      const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      const deviceFingerprint = event.headers["x-device-fingerprint"] || event.headers["X-Device-Fingerprint"] || "unknown";
      const deviceId = event.headers["x-device-id"] || event.headers["X-Device-Id"] || "unknown";

      // ── 1. Is this a retry of a failed job? ──
      let isRetry = false;
      let failedJobId = null;

      if (requestedJobId) {
        const { data: prevJob } = await supabase
          .from("extractions")
          .select("id, status, guest_id, idempotency_key")
          .eq("id", requestedJobId)
          .maybeSingle();
        if (prevJob && prevJob.guest_id === guestId && prevJob.status === "failed") {
          isRetry = true;
          failedJobId = prevJob.id;
        }
      }

      if (!isRetry) {
        const { data: prevJob } = await supabase
          .from("extractions")
          .select("id, status, guest_id")
          .eq("guest_id", guestId)
          .eq("idempotency_key", idempotencyKey)
          .eq("status", "failed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prevJob) {
          isRetry = true;
          failedJobId = prevJob.id;
        }
      }

      if (isRetry && failedJobId && !requestedJobId) {
        requestedJobId = failedJobId;
      }

      // ── 2. Hard limits (only for brand-new extractions) ──
      if (!isRetry) {
        // 2a. IP limit: sum across ALL guest records for this IP
        const { data: ipRecords } = await supabase
          .from("guest_extractions")
          .select("extraction_count")
          .eq("ip_address", clientIp);
        const totalIpExtractions = (ipRecords || []).reduce((sum, r) => sum + (r.extraction_count || 0), 0);
        if (totalIpExtractions >= 3) {
          return { statusCode: 429, headers, body: JSON.stringify({ error: "Free extraction limit reached for this network. Please sign up to continue.", code: "GUEST_IP_LIMIT_REACHED", isGuest: true }) };
        }

        // 2b. Device fingerprint limit: ANY record with this fingerprint?
        const { data: fpRecords } = await supabase
          .from("guest_extractions")
          .select("extraction_count")
          .eq("device_fingerprint", deviceFingerprint);
        const hasFpExtraction = (fpRecords || []).some(r => (r.extraction_count || 0) >= 1);
        if (hasFpExtraction) {
          return { statusCode: 402, headers, body: JSON.stringify({ error: "Free extraction used on this device. Please sign up to continue.", code: "GUEST_FINGERPRINT_LIMIT_REACHED", isGuest: true }) };
        }

        // 2c. Device ID limit: ANY record with this device_id?
        if (deviceId !== "unknown") {
          const { data: devRecords } = await supabase
            .from("guest_extractions")
            .select("extraction_count")
            .eq("device_id", deviceId);
          const hasDevExtraction = (devRecords || []).some(r => (r.extraction_count || 0) >= 1);
          if (hasDevExtraction) {
            return { statusCode: 402, headers, body: JSON.stringify({ error: "Free extraction used on this device. Please sign up to continue.", code: "GUEST_DEVICE_LIMIT_REACHED", isGuest: true }) };
          }
        }

        // 2d. Strict mode: same IP with a different fingerprint already extracted?
        // This stops users from rotating fingerprints on the same network.
        const { data: ipFpRecords } = await supabase
          .from("guest_extractions")
          .select("device_fingerprint, extraction_count")
          .eq("ip_address", clientIp)
          .neq("device_fingerprint", deviceFingerprint);
        const ipHasOtherDevice = (ipFpRecords || []).some(r => (r.extraction_count || 0) >= 1);
        if (ipHasOtherDevice && totalIpExtractions >= 1) {
          return { statusCode: 429, headers, body: JSON.stringify({ error: "Free extraction limit reached for this network. Please sign up to continue.", code: "GUEST_IP_LIMIT_REACHED", isGuest: true }) };
        }

        // 2e. Guest ID limit
        const { data: guestRecord } = await supabase
          .from("guest_extractions")
          .select("extraction_count, first_used")
          .eq("guest_id", guestId)
          .maybeSingle();
        const extractionCount = guestRecord ? guestRecord.extraction_count : 0;
        const daysActive = guestRecord ? (Date.now() - new Date(guestRecord.first_used).getTime()) / (1000 * 60 * 60 * 24) : 0;

        if (daysActive > 30 && extractionCount > 0) {
          return { statusCode: 403, headers, body: JSON.stringify({ error: "Guest session expired (30 days). Please sign up to continue.", code: "GUEST_EXPIRED", isGuest: true }) };
        }
        if (extractionCount >= 1) {
          return { statusCode: 402, headers, body: JSON.stringify({ error: "Free extraction used (1/1). Sign up for more.", code: "GUEST_LIMIT_REACHED", isGuest: true }) };
        }

        // ── Mark as used IMMEDIATELY ──
        if (!guestRecord) {
          await supabase.from("guest_extractions").insert({
            guest_id: guestId,
            ip_address: clientIp,
            device_fingerprint: deviceFingerprint,
            device_id: deviceId !== "unknown" ? deviceId : null,
            extraction_count: 1,
            first_used: new Date().toISOString(),
            last_used: new Date().toISOString(),
          });
        } else {
          await supabase.from("guest_extractions").update({
            extraction_count: 1,
            device_fingerprint: deviceFingerprint, 
            device_id: deviceId !== "unknown" ? deviceId : guestRecord.device_id,
            last_used: new Date().toISOString(),
          }).eq("guest_id", guestId);
        }
      }
    }

    // ── Credit expiration check (fail fast) ──
    if (!isGuest && userId) {
      const { data: userProfile } = await supabase.from("profiles").select("created_at, credits_remaining").eq("id", userId).single();
      const { data: hasPurchased } = await supabase.from("credit_transactions").select("id").eq("user_id", userId).eq("type", "purchase").limit(1);
      const accountAgeDays = (Date.now() - new Date(userProfile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (!hasPurchased?.length && accountAgeDays > 90 && userProfile.credits_remaining > 0) {
        await supabase.from("profiles").update({ credits_remaining: 0 }).eq("id", userId);
        await supabase.from("credit_transactions").insert({
          user_id: userId, amount: -userProfile.credits_remaining, type: "expiry",
          balance_after: 0, status: "completed",
          metadata: { reason: "signup_bonus_expired", account_age_days: Math.floor(accountAgeDays) }
        });
        return { statusCode: 402, headers, body: JSON.stringify({ error: "Your welcome credits have expired after 90 days. Purchase credits to continue.", code: "BONUS_EXPIRED", expiredAmount: userProfile.credits_remaining }) };
      }
    }

    // ── IDEMPOTENCY / RECOVERY ──
    let cachedJob = null;

    if (requestedJobId) {
      const { data: requestedJob } = await supabase.from("extractions")
        .select("id, status, raw_result, actual_cost, estimated_cost, created_at, updated_at, user_id, guest_id, file_name, file_type, document_type")
        .eq("id", requestedJobId).maybeSingle();

      if (requestedJob) {
        const belongsToCurrentUser =
          (!requestedJob.user_id && !userId) ||
          (requestedJob.user_id && requestedJob.user_id === userId) ||
          (requestedJob.guest_id && requestedJob.guest_id === guestId);
        if (belongsToCurrentUser) cachedJob = requestedJob;
      }
    }

    if (!cachedJob) {
      const { data: existingJob } = await supabase.from("extractions")
        .select("id, status, raw_result, actual_cost, estimated_cost, created_at, updated_at, user_id, guest_id, file_name, document_type")
        .eq("idempotency_key", idempotencyKey)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      cachedJob = existingJob || null;
    }

    // ── Stale job detection ──
    const STALE_MINUTES = 10;
    if (cachedJob?.status === "processing") {
      const updatedAt = new Date(cachedJob.updated_at);
      const staleMinutes = (Date.now() - updatedAt.getTime()) / 60000;
      if (staleMinutes > STALE_MINUTES) {
        await supabase.from("extractions").update({
          status: "failed", error_message: "Previous attempt timed out. Retry started.", updated_at: new Date().toISOString(),
        }).eq("id", cachedJob.id);
        cachedJob = null;
      }
    }

    // ── Return completed result immediately ──
  if (cachedJob?.status === "completed" && cachedJob.raw_result) {
  const rawResult = cachedJob.raw_result;
  const docType = (
    rawResult.document_type ||
    rawResult.category ||
    cachedJob.document_type ||
    "generic"
   )
    .toString()
    .toLowerCase()
    .trim();

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
      .update({ last_used: new Date().toISOString() })
      .eq("guest_id", guestId);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      status: "completed",
      jobId: cachedJob.id,
      extractionId: cachedJob.id,
      isGuest,
      fileName: cachedJob.file_name || file.name,
      fileType: cachedJob.file_type || validation.mimeType,
      documentType: docType,
      documentSummary:
        rawResult.document_summary ||
        rawResult.documentSummary ||
        null,
      originalSegments:
        rawResult.originalSegments ||
        rawResult.segments ||
        [],
      segments: rawResult.segments || [],
      savedPattern: rawResult.savedPattern || null,
      metadata: {
        documentFingerprint,
        patternVersion:
          rawResult.metadata?.patternVersion || 1,
        processedAt:
          cachedJob.updated_at ||
          cachedJob.created_at ||
          new Date().toISOString(),
        extraction: {
          ...(rawResult.metadata?.extraction || {}),
          finalMethod: "cached",
          textLength:
            rawResult.metadata?.extraction?.textLength || 0,
          wordCount:
            rawResult.metadata?.extraction?.wordCount || 0,
          estimatedPages: cachedJob.estimated_cost || 0,
        },
        creditsUsed: isGuest ? 0 : cachedJob.actual_cost || 0,
        newBalance: isGuest ? null : currentBalance,
        cached: true,
        recovered: true,
      },
    }),
  };
}

    // ── Return 202 if still processing ──
    if (cachedJob?.status === "processing") {
      return {
        statusCode: 202, headers,
        body: JSON.stringify({ status: "processing", jobId: cachedJob.id, extractionId: cachedJob.id, retryAfter: 3 }),
      };
    }

    // ── Generate new job ID ──
    const extractionId = cachedJob?.id || crypto.randomUUID();

    // ── Stage file to Supabase Storage ──
    const storagePath = `pending/${extractionId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from("extraction-uploads").upload(storagePath, file.buffer, {
      contentType: file.type || validation.mimeType,
      upsert: true,
    });
    if (uploadError) throw new Error(`Failed to stage file: ${uploadError.message}`);

    // ── Upsert DB record ──
    const estimatedCost = estimateCreditCost(file.buffer.toString("utf8").slice(0, 5000), file.name);
    const jobPayload = {
      id: extractionId,
      idempotency_key: idempotencyKey,
      user_id: userId || null,
      guest_id: isGuest ? guestId : null,
      document_type: "unknown",
      file_name: file.name,
      file_type: file.type || validation.mimeType || null,
      estimated_cost: estimatedCost,
      actual_cost: 0,
      tokens_approx: Math.ceil(file.buffer.length / 4),
      status: "processing",
      error_message: null,
      raw_result: null,
      storage_path: storagePath,
      document_fingerprint: documentFingerprint,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let dbError = null;
    if (cachedJob?.id) {
      const { error } = await supabase.from("extractions").update(jobPayload).eq("id", extractionId);
      dbError = error;
    } else {
      const { error } = await supabase.from("extractions").insert(jobPayload);
      dbError = error;
    }

    if (dbError) {
      // Clean up the staged file since DB row failed
      await supabase.storage.from("extraction-uploads").remove([storagePath]).catch(() => {});
      throw new Error(`Failed to create extraction job: ${dbError.message}`);
    }

    // ── Trigger background worker ──
    const backgroundUrl = `${process.env.URL || "http://localhost:8888"}/.netlify/functions/extract-background`;
    
    fetch(backgroundUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extractionId }),
    }).catch((err) => console.error("Background trigger failed:", err.message));

    // ── Return 202 Accepted immediately ──
    return {
      statusCode: 202, headers,
      body: JSON.stringify({
        status: "processing",
        jobId: extractionId,
        extractionId,
        retryAfter: 3,
        message: "Extraction started. Poll /check-job for completion.",
      }),
    };

  } catch (err) {
    console.error("Extract orchestrator error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Extraction failed", message: err.message }) };
  }
};