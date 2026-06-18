import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { user_id, email, amount, credit_amount, package_id } = JSON.parse(event.body);

    if (!user_id || !email || !amount || !credit_amount) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Verify user
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.id !== user_id) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
    }

    // Call Paystack API
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        amount, // Already in cents from frontend
        currency: 'USD',
        callback_url: `${process.env.SITE_URL || 'http://localhost:8888'}/#payment-success`,
        metadata: {
          user_id,
          credit_amount,
          package_id,
          custom_fields: [
            { display_name: "Package", variable_name: "package", value: package_id },
            { display_name: "Credits", variable_name: "credits", value: String(credit_amount) }
          ]
        }
      })
    });

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || 'Paystack initialization failed');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        authorization_url: data.data.authorization_url,
        reference: data.data.reference
      })
    };

  } catch (error) {
    console.error('Paystack initiate error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
}