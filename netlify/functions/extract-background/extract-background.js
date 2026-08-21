// netlify/functions/extract-background/extract-background.js
const config = require("../../../config");
const { extractTextFromFile } = require("../services/extractor-service");
const { cleanOCR } = require("../utils/clean-ocr");
const AIClient = require("../utils/ai-client");
const { createClient } = require("@supabase/supabase-js");
const { calculateExtractionCost, deductCredits, estimateExtractionCost } = require("../lib/credits");
const crypto = require("crypto");


function applyCorrections(extractedData, corrections) {
  if (!extractedData.segments) return extractedData;
  extractedData.segments.forEach((seg) => {
    (seg.fields || []).forEach((field) => {
      const key = `${seg.segment_name}.${field.label}`;
      if (corrections[key]) {
        if (corrections[key].action === "delete") field._deleted = true;
        else field.value = corrections[key].to;
      }
      const labelKey = `${key}._label`;
      if (corrections[labelKey]) {
        if (corrections[labelKey].action === "delete") field._deleted = true;
        else field.label = corrections[labelKey].to;
      }
    });
    seg.fields = (seg.fields || []).filter((f) => !f._deleted);
  });
  return extractedData;
}

function normalizeSegments(segments) {
  return segments.map((seg) => {
    const fields = seg.fields || [];
    const objectFields = fields.filter((f) => f.value && typeof f.value === "object" && !Array.isArray(f.value));
    if (objectFields.length === fields.length && fields.length > 1) return seg;

    const tableKeywords = /line|item|product|entry|detail|row/i;
    if (tableKeywords.test(seg.segment_name) && fields.length > 1) {
      return { ...seg, fields: fields.map((f) => ({ ...f, value: tryParseStructured(f.value, f.label) })) };
    }

    const cleanedFields = fields.map((f) => {
      if (f.value && typeof f.value === "object" && !Array.isArray(f.value)) {
        const keys = Object.keys(f.value);
        if (keys.length === 1 && keys[0] === "value") return { ...f, value: f.value.value };
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


async function cleanupOrphanedFiles(supabase) {
  try {
    const { data: oldJobs } = await supabase
      .from("extractions")
      .select("storage_path, id")
      .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .not("storage_path", "is", null)
      .in("status", ["completed", "failed"]); // ← only finished jobs

    if (oldJobs?.length > 0) {
      const paths = oldJobs.map(j => j.storage_path).filter(Boolean);
      await supabase.storage.from("extraction-uploads").remove(paths);
      await supabase.from("extractions")
        .update({ storage_path: null })
        .in("id", oldJobs.map(j => j.id));
      // console.log(`Cleaned up ${paths.length} orphaned files`);
    }
  } catch (e) {
    console.warn("Orphan cleanup failed:");
  }
}


exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Background functions receive the event body directly
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid payload" }) };
  }

  const { extractionId } = payload;
  if (!extractionId) return { statusCode: 400, body: JSON.stringify({ error: "extractionId required" }) };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  await cleanupOrphanedFiles(supabase);

  try {
    // ── 1. Fetch job record ──
    const { data: job, error: jobError } = await supabase.from("extractions")
      .select("*").eq("id", extractionId).single();
    if (jobError || !job) throw new Error("Job not found");

    // ── 2. Idempotency: already completed? ──
    if (job.status === "completed" && job.raw_result) {
      // console.log(`Background worker: ${extractionId} already completed. Skipping.`);
      await cleanupStorage(supabase, job.storage_path);
      return { statusCode: 200, body: JSON.stringify({ status: "already_completed", extractionId }) };
    }

    // ── 3. Download file from storage ──
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("extraction-uploads").download(job.storage_path);
    if (downloadError) throw new Error(`Download failed: ${downloadError.message}`);

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const file = { name: job.file_name, buffer, type: job.file_type, size: buffer.length };

    // ── 4. Extract text ──
    const extraction = await extractTextFromFile(file);
    let finalText = extraction.text;
    let extractionMethod = extraction.metadata.method;
    const cleanedText = cleanOCR(finalText || "");

    if (!cleanedText || cleanedText.length < 10) {
      await supabase.from("extractions").update({
        status: "failed", error_message: "Could not extract readable text from document",
        updated_at: new Date().toISOString(),
      }).eq("id", extractionId);
      await cleanupStorage(supabase, job.storage_path);
      return { statusCode: 422, body: JSON.stringify({ error: "Empty text extraction" }) };
    }

    // ── 5. Credit check (read-only, fail fast) ──
    const isGuest = !job.user_id;
    const userId = job.user_id;
    const wordCount = cleanedText.split(/\s+/).filter((w) => w.length > 0).length;
    const cost = estimateExtractionCost(wordCount);

    if (!isGuest && userId) {
      const { data: profile } = await supabase.from("profiles").select("credits_remaining").eq("id", userId).single();
      if (!profile || profile.credits_remaining < cost) {
        await supabase.from("extractions").update({
          status: "failed", error_message: "Insufficient credits",
          updated_at: new Date().toISOString(),
        }).eq("id", extractionId);
        await cleanupStorage(supabase, job.storage_path);
        return { statusCode: 402, body: JSON.stringify({ error: "Insufficient credits", required: cost, available: profile?.credits_remaining || 0 }) };
      }
    }

    // ── 6. AI Extraction ──
    let extractedData;
    let docType = "generic";
    let actualCost = cost;

        let usage = null;
    try {
      const aiClient = new AIClient();
      // REQUIREMENT: your AIClient.extract() must now return { data, usage }
      // usage = { prompt_tokens, completion_tokens, total_tokens, model }
      const aiResult = await aiClient.extract(cleanedText);
      extractedData = aiResult.data;
      usage = aiResult.usage || {};

      docType = (extractedData.document_type || extractedData.category || "generic").toString().toLowerCase().trim();
      actualCost = calculateExtractionCost({
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        model: usage.model || config?.ai?.provider || "default",
      });

    } catch (aiError) {
      await supabase.from("extractions").update({
        status: "failed", error_message: aiError.message, actual_cost: 0,
        updated_at: new Date().toISOString(),
      }).eq("id", extractionId);
      await cleanupStorage(supabase, job.storage_path);
      return { statusCode: 500, body: JSON.stringify({ error: "AI extraction failed", message: aiError.message }) };
    }

    // ── 7. Build result payload ──
    const rawSegments = normalizeSegments(Array.isArray(extractedData.segments) ? extractedData.segments : []);
    const originalSegments = JSON.parse(JSON.stringify(rawSegments));

    // ── 8. Load saved patterns ──
    let savedPattern = null;
    let patternApplied = false;

    if (!isGuest && userId) {
      const { data: patterns } = await supabase.from("extraction_patterns")
        .select("*").eq("user_id", userId).eq("document_fingerprint", job.document_fingerprint)
        .order("last_used_at", { ascending: false }).limit(1);
      if (patterns?.length > 0) {
        savedPattern = patterns[0]; patternApplied = true;
        await supabase.from("extraction_patterns").update({
          usage_count: patterns[0].usage_count + 1, last_used_at: new Date().toISOString(),
        }).eq("id", patterns[0].id);
      }
    }

    if (!isGuest && userId && !savedPattern) {
      const { data: typePatterns } = await supabase.from("extraction_patterns")
        .select("*").eq("user_id", userId).eq("document_type", docType)
        .order("last_used_at", { ascending: false }).limit(1);
      if (typePatterns?.length > 0) {
        savedPattern = typePatterns[0]; patternApplied = true;
        await supabase.from("extraction_patterns").update({
          usage_count: typePatterns[0].usage_count + 1, last_used_at: new Date().toISOString(),
        }).eq("id", typePatterns[0].id);
      }
    }

    // Apply corrections
    extractedData.segments = JSON.parse(JSON.stringify(rawSegments));
    if (savedPattern?.corrections) applyCorrections(extractedData, savedPattern.corrections);
    const segments = extractedData.segments;

    // ── 9. SAVE RESULT FIRST (before charging) ──
    const resultPayload = {
      status: "completed",
      raw_result: {
        ...extractedData,
        document_type: docType,
        segments,
        originalSegments,
        savedPattern,
        metadata: {
          documentFingerprint: job.document_fingerprint,
          patternVersion: 1,
          extraction: {
            textLength: cleanedText.length,
            wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
            finalMethod: extractionMethod,
          },
        },
      },
      document_type: docType,
      actual_cost: actualCost,
      error_message: null,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = await supabase.from("extractions").update(resultPayload).eq("id", extractionId);
    if (saveError) throw new Error(`Failed to save result: ${saveError.message}`);

        // ── 10. CHARGE CREDITS (after successful save) ──
    let newBalance = null;
    if (!isGuest && userId) {
      try {
                const deduction = await deductCredits(
          supabase,
          userId,
          actualCost,
          "extraction",
          extractionId,
          {
            file_name: job.file_name,
            estimated_cost: cost, 
            document_type: docType,
            words: cleanedText.split(/\s+/).filter((w) => w.length > 0).length,
            chars: cleanedText.length,
            model: usage?.model || config?.ai?.provider || "unknown",
            tokens_used: usage, 
          }
        );
        if (deduction.success) {
          newBalance = deduction.balance;
        } else {
          console.error(`Post-save charge failed for ${extractionId}:`, deduction.error);
        }
      } catch (chargeErr) {
        console.error(`Post-save charge failed for ${extractionId}:`, chargeErr.message);
      }
    }
    
       // ── 11. Update guest last_used only (count was set in orchestrator) ──
    if (isGuest && job.guest_id) {
      await supabase.from("guest_extractions").update({
        last_used: new Date().toISOString(),
      }).eq("guest_id", job.guest_id);
    }

    // ── 12. Cleanup storage ──
    await cleanupStorage(supabase, job.storage_path);

    console.log(`Background worker completed: ${extractionId}`);
    return { statusCode: 200, body: JSON.stringify({ status: "completed", extractionId, newBalance }) };

  } catch (err) {
    console.error("Background worker fatal error:", err);
    // Mark job as failed if not already
    await supabase.from("extractions").update({
      status: "failed", error_message: err.message, updated_at: new Date().toISOString(),
    }).eq("id", extractionId).eq("status", "processing"); // Only if still processing
    return { statusCode: 500, body: JSON.stringify({ error: "Background extraction failed", message: err.message }) };
  }
};

async function cleanupStorage(supabase, path) {
  if (!path) return;
  try {
    await supabase.storage.from("extraction-uploads").remove([path]);
  } catch (e) {
    console.warn("Storage cleanup failed:", e.message);
  }
}