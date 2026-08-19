// netlify/functions/user-stats.js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };

  const { data: profile } = await supabase.from('profiles').select('credits_remaining').eq('id', user.id).single();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo);

    const creditsUsed = transactions?.filter(t => t.type === 'debit' && t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

  const documentsProcessed = transactions?.filter(t => t.feature === 'extraction' && t.type === 'debit').length || 0;
  const timeSaved = Math.round(documentsProcessed * 4 / 60 * 10) / 10; 
  const moneySaved = Math.round(timeSaved * 50); 

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      creditsRemaining: profile?.credits_remaining || 0,
      creditsUsed: Math.round(creditsUsed * 10) / 10,
      documentsProcessed,
      timeSaved,
      moneySaved,
      avgProcessingTime: 3.2
    })
  };
};