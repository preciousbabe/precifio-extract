// netlify/functions/auth-me.js

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    let userProfile = profile;

    if (!userProfile) {
      console.log('No profile found for user', user.id, '- creating with 10 credits');

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          company_name: user.user_metadata?.company_name || null,
          credits_remaining: 10,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create profile:', createError);
        // Fallback: return minimal profile so frontend still works
        userProfile = {
          id: user.id,
          email: user.email,
          credits_remaining: 10,
          full_name: user.user_metadata?.full_name || null,
          company_name: user.user_metadata?.company_name || null
        };
      } else {
        userProfile = newProfile;
      }
    }

    console.log('auth-me returning profile with credits:', userProfile?.credits_remaining);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        user,
        profile: userProfile,
        session: { access_token: token, user }
      })
    };

  } catch (error) {
    console.error('auth-me error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};