// ── SHARED CREDIT HELPERS (CommonJS) ──────────────────

const RECONCILIATION_RATES = {
  per_document: 0.15,
  per_match:    0.10,
  base:         0.50,
  min_charge:   0.50,
  max_charge:   25.00,
};

function calculateReconciliationCost(sideACount, sideBCount, matchCount = 0) {
  const r = RECONCILIATION_RATES;
  const docCost = (sideACount + sideBCount) * r.per_document;
  const matchCost = matchCount * r.per_match;
  const total = r.base + docCost + matchCost;
  return Math.min(Math.max(Math.round(total * 10) / 10, r.min_charge), r.max_charge);
}

function estimateReconciliationCost(sideACount, sideBCount) {
  const r = RECONCILIATION_RATES;
  const docCost = (sideACount + sideBCount) * r.per_document;
  const estimated = r.base + docCost;
  return Math.min(Math.max(Math.round(estimated * 10) / 10, r.min_charge), r.max_charge);
}

async function getUserCredits(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single();
  if (error || !data) return 0;
  return data.credits_remaining || 0;
}

async function deductCredits(supabase, userId, amount, feature, referenceId, metadata = {}) {
  if (!userId || amount <= 0) {
    return { success: false, error: "Invalid deduction request" };
  }

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single();

  if (readErr || !profile) {
    return { success: false, error: "User profile not found" };
  }
  if (profile.credits_remaining < amount) {
    return { success: false, error: "Insufficient credits" };
  }

  const newBalance = profile.credits_remaining - amount;

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      credits_remaining: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (upErr) {
    return { success: false, error: upErr.message };
  }

  const { error: txErr } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -amount,
    type: "debit",
    feature: feature,
    reference_id: referenceId,
    balance_after: newBalance,
    metadata: metadata,
    status: "completed",
  });

  if (txErr) {
    console.warn(`[${feature}] Transaction log failed:`, txErr);
  }

  return { success: true, balance: newBalance };
}

module.exports = {
  RECONCILIATION_RATES,
  calculateReconciliationCost,
  estimateReconciliationCost,
  getUserCredits,
  deductCredits,
};