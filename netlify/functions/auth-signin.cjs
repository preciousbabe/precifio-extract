const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false; // ← FIX: prevents timeout hang

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { companyName, password } = JSON.parse(event.body || '{}');

  if (!companyName || !password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Company name and password required' }) };
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, id')
      .ilike('company_name', companyName.trim()) // ← case-insensitive match
      .maybeSingle();

    if (profileError || !profile) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Company not found' }) };
    }

    const publicClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (authError) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        session: authData.session,
        user: authData.user
      })
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};