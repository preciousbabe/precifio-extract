const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const payload = JSON.parse(event.body);
    console.log('Paystack webhook:', payload.event);

    if (payload.event === 'charge.success') {
      const { data } = payload;
      const userId = data.metadata?.user_id;
      const creditAmount = parseInt(data.metadata?.credit_amount, 10);

      if (!userId || !creditAmount) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing metadata' }) };
      }

      // Add credits
      const { data: current } = await supabase
        .from('profiles')
        .select('credits_remaining')
        .eq('id', userId)
        .single();

      const newBalance = (current?.credits_remaining || 0) + creditAmount;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits_remaining: newBalance })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: creditAmount,
        type: 'purchase',
        balance_after: newBalance,
        reference_id: data.reference,
        metadata: {
          paystack_reference: data.reference,
          amount_paid_usd: data.amount / 100,
          payment_channel: data.channel,
          paid_at: data.paid_at
        }
      });

      console.log(`Added ${creditAmount} credits to user ${userId}. Balance: ${newBalance}`);

      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ success: true, credits_added: creditAmount, new_balance: newBalance }) 
      };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ received: true }) };

  } catch (error) {
    console.error('Paystack webhook error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};