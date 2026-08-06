const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const jobId = event.queryStringParameters?.jobId;
  if (!jobId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'jobId required' }) };

  const { data: job } = await supabase
    .from('extractions')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Job not found' }) };

  if (job.status === 'processing') {
    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ status: 'processing', retryAfter: 3 })
    };
  }

  if (job.status === 'failed') {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'failed', error: job.error_message || 'Extraction failed' })
    };
  }

  // ── COMPLETED: return full UI payload ──
  const docType = (job.raw_result?.document_type || job.raw_result?.category || 'generic')
    .toString().toLowerCase().trim();

  let newBalance = null;
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (token && job.user_id) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user && user.id === job.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', user.id)
        .single();
      newBalance = profile?.credits_remaining ?? null;
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'completed',
      jobId: job.id,
      success: true,
      extractionId: job.id,
      isGuest: !job.user_id,
      fileName: job.file_name,
      fileType: job.file_type || 'application/octet-stream',
      documentType: docType,
      documentSummary: job.raw_result?.document_summary || null,
      originalSegments: job.raw_result?.segments || [],
      segments: job.raw_result?.segments || [],
      metadata: {
        documentFingerprint: job.raw_result?.metadata?.documentFingerprint || null,
        patternVersion: 1,
        processedAt: job.updated_at || job.created_at,
        extraction: {
          finalMethod: job.raw_result?.metadata?.extraction?.finalMethod || 'ai',
          textLength: job.ocr_text?.length || 0,
          wordCount: job.raw_result?.metadata?.extraction?.wordCount || 0,
          estimatedPages: job.estimated_cost,
        },
        creditsUsed: job.actual_cost || 0,
        newBalance,
      },
    })
  };
};