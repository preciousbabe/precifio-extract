// netlify/functions/auth-forgot.js
const { createClient } = require('@supabase/supabase-js');

const supabase    = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RESEND_KEY  = process.env.RESEND_API_KEY;
const SITE_URL    = process.env.URL || 'https://extract.precifio.app';

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { companyName, email } = JSON.parse(event.body || '{}');
  let targetEmail = email;

  // Look up email by company name (consistent with your login flow)
  if (!targetEmail && companyName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('company_name', companyName.trim())
      .maybeSingle();
    targetEmail = profile?.email;
  }

  // Security: always return 200 so bad actors can't enumerate accounts
  if (!targetEmail) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'If an account exists, a reset email has been sent.' })
    };
  }

  try {
    // Generate recovery link (does NOT send email — we send our own branded one)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
      options: { redirectTo: `${SITE_URL}/?mode=reset` }
    });

    if (linkError) throw linkError;

    // Send branded reset email via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Precifio <noreply@precifio.app>',
        to: targetEmail,
        subject: 'Reset your Precifio password',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Password Reset Request</h2>
            <p>You requested a password reset for your Precifio Extract account.</p>
            <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
            <p style="margin-top: 24px;">
              <a href="${linkData.properties.action_link}"
                 style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
              Didn't request this? You can safely ignore this email.
            </p>
          </div>
        `
      })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'If an account exists, a reset email has been sent.' })
    };

  } catch (err) {
    console.error('auth-forgot error:', err);
    // Still mask the error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'If an account exists, a reset email has been sent.' })
    };
  }
};