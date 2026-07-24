// netlify/functions/save-pattern/save-pattern.js
const { createClient } = require("@supabase/supabase-js");

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;

    if (!token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required" }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: "Invalid token" }) };
    }

    const body = JSON.parse(event.body);
    const {
      extractionId,
      documentFingerprint,
      documentType,
      originalSegments,
      editedSegments,
    } = body;

    // Compute corrections (diff between original and edited)
    const corrections = computeCorrections(originalSegments, editedSegments);

    // Upsert pattern: if same user + fingerprint exists, update it
    const { data: existing } = await supabase
      .from("extraction_patterns")
      .select("id, usage_count")
      .eq("user_id", user.id)
      .eq("document_fingerprint", documentFingerprint)
      .maybeSingle();

    let result;
    if (existing) {
      // Merge corrections: new corrections override old ones for same keys
      const { data: current } = await supabase
        .from("extraction_patterns")
        .select("corrections")
        .eq("id", existing.id)
        .single();

      const mergedCorrections = mergeCorrections(current.corrections, corrections);

      result = await supabase
        .from("extraction_patterns")
        .update({
          edited_segments: editedSegments,
          corrections: mergedCorrections,
          updated_at: new Date().toISOString(),
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("extraction_patterns")
        .insert({
          user_id: user.id,
          document_fingerprint: documentFingerprint,
          document_type: documentType,
          original_segments: originalSegments,
          edited_segments: editedSegments,
          corrections,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        patternId: result.data.id,
        correctionsApplied: Object.keys(corrections).length,
      }),
    };
  } catch (err) {
    console.error("Save pattern error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to save pattern", message: err.message }),
    };
  }
};

function computeCorrections(original, edited) {
  const corrections = {};

  const flatOriginal = flattenSegments(original);
  const flatEdited = flattenSegments(edited);

  for (const key in flatEdited) {
    if (flatOriginal[key] !== flatEdited[key]) {
      corrections[key] = {
        from: flatOriginal[key],
        to: flatEdited[key],
      };
    }
  }

  return corrections;
}

function flattenSegments(segments) {
  const flat = {};
  segments.forEach((seg, segIdx) => {
    const prefix = `${seg.segment_name || segIdx}`;
    (seg.fields || []).forEach((field, fieldIdx) => {
      const key = `${prefix}.${field.label || fieldIdx}`;
      flat[key] = field.value;
      flat[`${key}._label`] = field.label;
    });
  });
  return flat;
}

function mergeCorrections(oldCorr, newCorr) {
  return { ...oldCorr, ...newCorr };
}