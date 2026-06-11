import { supabase } from '../config/supabase.js';

export async function getUserCredits(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single();
  
  if (error || !data) return 0;
  return data.credits_remaining || 0;
}

export async function deductCredits(userId, amount) {
  const { data: current } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single();
  
  const available = current?.credits_remaining || 0;
  
  if (available < amount) {
    return { 
      success: false, 
      error: 'INSUFFICIENT_CREDITS',
      available,
      required: amount 
    };
  }

  const newBalance = available - amount;
  
  const { error } = await supabase
    .from('profiles')
    .update({ credits_remaining: newBalance })
    .eq('id', userId);
  
  if (error) {
    return { success: false, error: 'DEDUCTION_FAILED' };
  }
  
  return { success: true, newBalance, deducted: amount };
}

export async function addCredits(userId, amount, reason = 'purchase') {
  const { data: current } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single();
  
  const newBalance = (current?.credits_remaining || 0) + amount;
  
  const { error } = await supabase
    .from('profiles')
    .update({ credits_remaining: newBalance })
    .eq('id', userId);
  
  if (error) return { success: false };
  
  // Log credit transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    amount,
    type: reason,
    balance_after: newBalance
  });
  
  return { success: true, newBalance };
}

export async function rewardCorrection(userId, extractionId, fieldName) {
  // Only reward meaningful corrections
  const rewardableFields = ['vendor_name', 'category', 'total_amount', 'invoice_date'];
  
  if (!rewardableFields.includes(fieldName)) {
    return { success: false, reason: 'FIELD_NOT_REWARDABLE' };
  }

  // Check if already rewarded for this correction
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'correction_reward')
    .eq('reference_id', extractionId)
    .single();
  
  if (existing) {
    return { success: false, reason: 'ALREADY_REWARDED' };
  }

  return await addCredits(userId, 1, 'correction_reward');
}