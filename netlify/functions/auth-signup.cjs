// netlify/functions/auth-signup.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const RESEND_API_KEY = process.env.RESEND_API_KEY;

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

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

  const { email, password, fullName, companyName } = JSON.parse(event.body);

    // ── Block disposable emails ──
  const DISPOSABLE_DOMAINS = new Set([
    'tempmail.com','mailinator.com','guerrillamail.com','yopmail.com',
    'sharklasers.com','getairmail.com','10minutemail.com','burnermail.io',
    'temp-mail.org','fakeemail.com','trashmail.com','mailnesia.com',
    'dispostable.com','mailcatch.com','getnada.com','inboxbear.com',
    'tempail.com','throwawaymail.com','emailondeck.com','tempmailbox.net',
    'fakeinbox.com','mailforspam.com','spamgourmet.com','maildrop.cc',
    'harakirimail.com','temp-mail.ru','prtnx.com','ruru.be','mt2015.com',
    'trbvm.com','urltc.com','vomoto.com','wmail.cf','yomail.info',
    'zoho.in','kost.party','kiabws.com','vssms.com','xvx.us','yxdad.com',
    'zainmax.net','zippymail.info','zoemail.org','zomg.info','bccto.me',
    'chacuo.net','tmpmail.org','tempm.com','temp-mail.io','throwaway.com'
  ]);
  
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain || DISPOSABLE_DOMAINS.has(domain) || domain.includes('temp') || domain.includes('tmp') || domain.includes('throw') || domain.includes('fake') || domain.includes('trash')) {
    return { 
      statusCode: 400, 
      headers, 
      body: JSON.stringify({ error: 'Please use a permanent business email address' }) 
    };
  }
  // ──────────────────────────────

  if (!email || !password || !fullName || !companyName) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'All fields required' }) };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, company_name: companyName }
    });

    if (authError) throw authError;

    const userId = authData.user.id;

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

    // Log the signup bonus
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      amount: 10,
      type: 'bonus',
      balance_after: 10,
      status: 'completed',
      metadata: {
        reason: 'signup_bonus',
        full_name: fullName,
        company_name: companyName
      }
    });

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
            <p style="margin-top: 20px;">
              <a href="https://extract.precifio.app?mode=login" style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Log In to Precifio</a>
            </p>
            <p style="font-size: 12px; color: #6b7280; margin-top: 12px;">
              Click the button above to log in and start extracting documents with your 10 free credits.
            </p>
          </div>
        `
      })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Account created successfully! Check your email.',
        user: { id: userId, email, fullName, companyName }
      })
    };

  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
  }
};