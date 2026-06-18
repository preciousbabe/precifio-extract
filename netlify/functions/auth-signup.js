import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export const handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { email, password, fullName, companyName } = JSON.parse(event.body);

  if (!email || !password || !fullName || !companyName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'All fields required' }) };
  }

  try {
    // 1. Create auth user in Supabase (auto-confirmed since we handle emails via Resend)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, company_name: companyName }
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. MANUALLY insert into profiles table (no triggers!)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        company_name: companyName,
        credits_remaining: 10,
        created_at: new Date().toISOString()
      });

    if (profileError) throw profileError;

    // 3. Send welcome email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Precifio <noreply@precifio.app>',
        to: email,
        subject: 'Welcome to Precifio Extract!',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Welcome to Precifio Extract, ${fullName}!</h2>
            <p>Your company <strong>${companyName}</strong> is now registered.</p>
            <p>You have <strong>10 credits</strong> to start extracting documents.</p>
            <p>Login with your company name: <strong>${companyName}</strong></p>
            <br/>
            <a href="https://extract.precifio.app" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Go to Dashboard</a>
          </div>
        `
      })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Account created successfully! Check your email.',
        user: { id: userId, email, fullName, companyName }
      })
    };

  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }
};