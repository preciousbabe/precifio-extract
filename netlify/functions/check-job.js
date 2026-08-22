// netlify/functions/check-job.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STALE_MINUTES = 10;

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Guest-Id",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  const jobId = event.queryStringParameters?.jobId;
  
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;
  const guestId = event.headers["x-guest-id"] || event.headers["X-Guest-Id"] || null;
  
  console.log("[CHECK-JOB] Poll received. jobId:", jobId, "hasToken:", !!token, "hasGuest:", !!guestId);

  let userId = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) userId = user.id;
  }

  try {
    const { data: job, error: jobError } = await supabase.from("extractions")
      .select(`id, user_id, guest_id, status, file_name, file_type, document_type, estimated_cost, actual_cost, raw_result, error_message, created_at, updated_at`)
      .eq("id", jobId).maybeSingle();

    console.log("[CHECK-JOB] DB lookup. Found:", !!job, "Status:", job?.status, "Error:", jobError?.message || "none");
    if (jobError) return { statusCode: 500, headers, body: JSON.stringify({ error: "Database error", message: jobError.message }) };
    if (!job) return { statusCode: 404, headers, body: JSON.stringify({ error: "Job not found", jobId }) };

    // Ownership check
    const belongsToCurrentRequester =
      (job.user_id && userId && job.user_id === userId) ||
      (job.guest_id && guestId && job.guest_id === guestId);
    
    if (!belongsToCurrentRequester) {
      return { 
        statusCode: 403, 
        headers, 
        body: JSON.stringify({ error: "Unauthorized", jobId, hint: "Check x-guest-id header" }) 
      };
    }


    // Stale detection
    if (job.status === "processing") {
      const updatedAt = new Date(job.updated_at);
      const staleMinutes = (Date.now() - updatedAt.getTime()) / 60000;
      if (staleMinutes > STALE_MINUTES) {
        console.log("[CHECK-JOB] Job is STALE (>10min). Marking failed:", jobId);
        await supabase.from("extractions").update({
          status: "failed", error_message: "Extraction timed out. Please retry.",
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
        return {
          statusCode: 409, headers,
          body: JSON.stringify({ status: "failed", jobId, code: "JOB_STALE", error: "Extraction timed out. Please retry." }),
        };
      }
      return { statusCode: 202, headers, body: JSON.stringify({ status: "processing", jobId, retryAfter: 3 }) };
    }

    if (job.status === "failed") {
      return { statusCode: 500, headers, body: JSON.stringify({ status: "failed", jobId, error: job.error_message || "Extraction failed" }) };
    }

    if (job.status !== "completed" || !job.raw_result) {
      return { statusCode: 409, headers, body: JSON.stringify({ status: job.status || "unknown", jobId, error: "Extraction job has no completed result yet." }) };
    }

    // Completed
    console.log("[CHECK-JOB] Returning COMPLETED for:", jobId);
    const result = job.raw_result;
    const documentType = (result.document_type || result.category || job.document_type || "generic").toString().toLowerCase().trim();

    let newBalance = null;
    if (token && job.user_id) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user && user.id === job.user_id) {
          const { data: profile } = await supabase.from("profiles").select("credits_remaining").eq("id", user.id).maybeSingle();
          newBalance = profile?.credits_remaining ?? null;
        }
      } catch (e) { console.error("Balance lookup failed:", e.message); }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        status: "completed", success: true, jobId: job.id, extractionId: job.id, isGuest: !job.user_id,
        fileName: job.file_name,
        fileType: job.file_type || result.fileType || "application/octet-stream",
        documentType,
        documentSummary: result.document_summary || result.documentSummary || null,
        originalSegments: result.segments || [],
        segments: result.segments || [],
        savedPattern: result.savedPattern || null,
        metadata: {
          documentFingerprint: result.metadata?.documentFingerprint || null,
          patternVersion: result.metadata?.patternVersion || 1,
          processedAt: job.updated_at || job.created_at,
          extraction: {
            ...(result.metadata?.extraction || {}),
            finalMethod: result.metadata?.extraction?.finalMethod || "ai",
            textLength: result.metadata?.extraction?.textLength || 0,
            wordCount: result.metadata?.extraction?.wordCount || 0,
            estimatedPages: job.estimated_cost || 0,
          },
          creditsUsed: job.actual_cost || 0,
          newBalance,
        },
      }),
    };

  } catch (err) {
    console.error("[CHECK-JOB] FATAL:", err.message, err.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to check job", message: err.message }) };
  }
};