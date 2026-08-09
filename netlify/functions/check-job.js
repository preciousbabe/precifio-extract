// netlify/functions/check-job.js

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
  "Content-Type, Authorization, X-Guest-Id",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: "Method not allowed",
      }),
    };
  }

 const jobId = event.queryStringParameters?.jobId;

if (!jobId) {
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({
      error: "jobId required",
    }),
  };
}

// ------------------------------------------------------------
// AUTHENTICATE REQUESTER
// ------------------------------------------------------------

const authHeader =
  event.headers.authorization ||
  event.headers.Authorization;

const token = authHeader
  ? authHeader.replace(/^Bearer\s+/i, "")
  : null;

const guestId =
  event.headers["x-guest-id"] ||
  event.headers["X-Guest-Id"] ||
  null;

let userId = null;

if (token) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (!authError && user) {
    userId = user.id;
  }
}


  try {
    // ------------------------------------------------------------
    // 1. LOOK UP THE EXISTING JOB ONLY
    // ------------------------------------------------------------
    //
    // IMPORTANT:
    // This endpoint NEVER starts extraction.
    // It NEVER calls the AI.
    // It NEVER deducts credits.
    //
    const { data: job, error: jobError } = await supabase
      .from("extractions")
      .select(`
        id,
        user_id,
        guest_id,
        status,
        file_name,
        file_type,
        document_type,
        estimated_cost,
        actual_cost,
        raw_result,
        error_message,
        created_at,
        updated_at
      `)
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      console.error("check-job database error:", jobError);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to check extraction job",
          message: jobError.message,
        }),
      };
    }

    if (!job) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: "Job not found",
          jobId,
        }),
      };
    }



    // ------------------------------------------------------------
// VERIFY JOB OWNERSHIP
// ------------------------------------------------------------

const belongsToCurrentRequester =
  (job.user_id && userId && job.user_id === userId) ||
  (job.guest_id && guestId && job.guest_id === guestId);

if (!belongsToCurrentRequester) {
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({
      error: "Job not found",
      jobId,
    }),
  };
}


    // ------------------------------------------------------------
    // 2. STILL PROCESSING
    // ------------------------------------------------------------
    //
    // The original extract request may have timed out from the
    // browser/Netlify request perspective while the backend work
    // is still finishing.
    //
    // DO NOT mark this failed here.
    //
    if (job.status === "processing") {
      return {
        statusCode: 202,
        headers,
        body: JSON.stringify({
          status: "processing",
          jobId: job.id,
          retryAfter: 3,
        }),
      };
    }

    // ------------------------------------------------------------
    // 3. FAILED
    // ------------------------------------------------------------

    if (job.status === "failed") {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          status: "failed",
          jobId: job.id,
          error: job.error_message || "Extraction failed",
        }),
      };
    }

    // ------------------------------------------------------------
    // 4. ONLY COMPLETED JOBS REACH THIS POINT
    // ------------------------------------------------------------

    if (job.status !== "completed" || !job.raw_result) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          status: job.status || "unknown",
          jobId: job.id,
          error: "Extraction job has no completed result yet.",
        }),
      };
    }

    const result = job.raw_result;

    const documentType = (
      result.document_type ||
      result.category ||
      job.document_type ||
      "generic"
    )
      .toString()
      .toLowerCase()
      .trim();

    // ------------------------------------------------------------
    // 5. GET CURRENT CREDIT BALANCE
    // ------------------------------------------------------------
    //
    // READ ONLY.
    //
    // This endpoint does NOT charge anything.
    //
    let newBalance = null;

    if (token && job.user_id) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser(token);

        if (user && user.id === job.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits_remaining")
            .eq("id", user.id)
            .maybeSingle();

          newBalance = profile?.credits_remaining ?? null;
        }
      } catch (authError) {
        console.error(
          "check-job auth/balance lookup failed:",
          authError.message
        );

        // Do not fail an otherwise completed extraction just
        // because the balance lookup failed.
        newBalance = null;
      }
    }

    // ------------------------------------------------------------
    // 6. RETURN THE SAVED RESULT
    // ------------------------------------------------------------
    //
    // This is the critical recovery path.
    //
    // The frontend can receive this result even if the ORIGINAL
    // /extract request timed out.
    //
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: "completed",
        success: true,

        jobId: job.id,
        extractionId: job.id,

        isGuest: !job.user_id,

        fileName: job.file_name,

        fileType:
          job.file_type ||
          result.fileType ||
          "application/octet-stream",

        documentType,

        documentSummary:
          result.document_summary ||
          result.documentSummary ||
          null,

        originalSegments:
          result.segments || [],

        segments:
          result.segments || [],

        savedPattern:
          result.savedPattern ||
          null,

        metadata: {
          documentFingerprint:
            result.metadata?.documentFingerprint ||
            null,

          patternVersion:
            result.metadata?.patternVersion ||
            1,

          processedAt:
            job.updated_at ||
            job.created_at,

          extraction: {
            ...(result.metadata?.extraction || {}),

            finalMethod:
              result.metadata?.extraction?.finalMethod ||
              "ai",

            textLength:
              result.metadata?.extraction?.textLength ||
              0,

           wordCount:
      result.metadata?.extraction?.wordCount ||
        0,
            estimatedPages:
              job.estimated_cost || 0,
          },

          creditsUsed:
            job.actual_cost || 0,

          newBalance,
        },
      }),
    };
  } catch (err) {
    console.error("check-job handler error:", err);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to check extraction job",
        message: err.message,
      }),
    };
  }
};