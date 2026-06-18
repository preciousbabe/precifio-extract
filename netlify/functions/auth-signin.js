import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const handler = async (event, context) => {


  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { companyName, password } = JSON.parse(event.body);

  if (!companyName || !password) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Company name and password required' }) };
  }

  try {
    // 1. Find user by company name from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, id')
      .eq('company_name', companyName)
      .single();

    if (profileError || !profile) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Company not found' }) };
    }

    // 2. Sign in with email + password using public client
    const publicClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({
      email: profile.email,
      password: password
    });

    if (authError) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        session: authData.session,
        user: authData.user
      })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};