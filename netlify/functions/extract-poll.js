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

  // Completed — return minimal data, client should re-call extract.js to get normalized result
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ status: 'completed', jobId: job.id })
  };
};