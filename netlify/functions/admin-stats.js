// netlify/functions/admin-stats.js
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
  if (authErr || !user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid token' }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

    // Read cached stats (constant time, no table scans)
  const { data: cache } = await supabase.from('admin_stats_cache').select('*').single();
  const { data: docTypes } = await supabase.from('admin_doc_type_stats').select('*');

  // Recent transactions
  const { data: recentTx } = await supabase
    .from('credit_transactions')
    .select('user_id, amount, metadata, created_at')
    .eq('type', 'purchase')
    .order('created_at', { ascending: false })
    .limit(10);

  const userIds = [...new Set((recentTx || []).map(t => t.user_id))];
  const { data: userProfiles } = await supabase.from('profiles').select('id, email').in('id', userIds);
  const emailMap = {};
  (userProfiles || []).forEach(p => emailMap[p.id] = p.email);

    const avgPurchaseValue = cache?.total_purchase_count > 0 
    ? cache.total_purchase_amount / cache.total_purchase_count 
    : 0;

  const successRate = cache?.total_extractions > 0 
    ? (cache.successful_extractions / cache.total_extractions) * 100 
    : 0;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      totalRevenue: cache?.total_revenue || 0,
      revenueThisMonth: cache?.revenue_this_month || 0,
      totalUsers: cache?.total_users || 0,
      payingCustomers: cache?.paying_customers || 0,
      totalExtractions: cache?.total_extractions || 0,
      successRate,
      creditsInCirculation: cache?.credits_in_circulation || 0,
      avgPurchaseValue,
      documentTypeBreakdown: docTypes || [],
        recentTransactions: (recentTx || []).map(t => ({
        email: emailMap[t.user_id] || 'unknown',
        package: t.metadata?.package_id || 'unknown',
        amount: t.metadata?.amount_paid ? parseInt(t.metadata.amount_paid, 10) : 0,
        created_at: t.created_at
      }))
    })
  };
};