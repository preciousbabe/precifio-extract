// netlify/functions/admin-user-lookup.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };

  const { data: adminCheck } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const email = event.queryStringParameters?.email?.trim();
  const company = event.queryStringParameters?.company?.trim();

  if (!email && !company) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide email or company query param' }) };
  }

  let query = supabase.from('profiles').select('*');
  if (email) query = query.ilike('email', `%${email}%`);
  if (company) query = query.ilike('company_name', `%${company}%`);

  const { data: profiles } = await query.limit(10);

  if (!profiles || profiles.length === 0) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'No users found' }) };
  }

  const results = await Promise.all(profiles.map(async (p) => {
    const [{ data: transactions }, { data: extractions }] = await Promise.all([
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', p.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('extractions')
        .select('*')
        .eq('user_id', p.id)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    return {
      profile: p,
      transactions: transactions || [],
      extractions: extractions || []
    };
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ results })
  };
};