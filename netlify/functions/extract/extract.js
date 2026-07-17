// netlify/functions/extract/extract.js
const config = require("../../../config");
const { validateUpload } = require("../utils/validate-upload");
const { extractTextFromFile } = require("../services/extractor-service");
const { cleanOCR } = require("../utils/clean-ocr");
const AIClient = require("../utils/ai-client");
const { createClient } = require("@supabase/supabase-js");
const parseMultipartLib = require("parse-multipart");

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

function calculatePageCost(text) {
  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 500));
  return Math.min(estimatedPages, 50);
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

    // Guest tracking
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
            daysActive: Math.floor(daysActive),
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
            extractionCount,
            limit: 1,
          }),
        };
      }

      if (guestRecord) {
        await supabase
          .from("guest_extractions")
          .update({
            extraction_count: extractionCount + 1,
            last_used: new Date().toISOString(),
          })
          .eq("guest_id", guestId);
      } else {
        await supabase.from("guest_extractions").insert({
          guest_id: guestId,
          extraction_count: 1,
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

    const cost = calculatePageCost(cleanedText);

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

    // AI extraction
    let extractedData;
    try {
      const aiClient = new AIClient();
      extractedData = await aiClient.extract(cleanedText);
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

    // Normalize segments for tabular detection
    const segments = Array.isArray(extractedData.segments)
  ? extractedData.segments
  : [];

    // Update transaction to completed
    if (!isGuest && userId && transactionId) {
      const { error: updateError } = await supabase
        .from("credit_transactions")
        .update({ status: "completed" })
        .eq("id", transactionId);

      if (updateError) {
        console.error("Failed to update transaction status:", updateError);
      }
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
        segments,
        metadata: {
          extraction: {
            ...extraction.metadata,
            finalMethod: extractionMethod,
            textLength: cleanedText.length,
            wordCount: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
            estimatedPages: cost,
          },
          aiProvider: config.ai.provider,
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
 * keep it as-is. If values are flat strings, wrap them as objects.
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

    return seg;
  });
}

/**
 * Try to parse a flat string into a structured object.
 * Example: "Description: Industrial CNC Machine\nSKU: CNC-X2K\nQty: 2"
 */
function tryParseStructured(value, label) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return { value };

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

  return hasStructured ? obj : { value };
}