// netlify/functions/lib/credit.js
// ── UNIFIED TOKEN-BASED CREDIT ENGINE ──────────────────

// 1 Precifio Credit = $0.10 USD
const CREDIT_USD_VALUE = 0.10;

// AI model pricing: USD per 1M tokens (UPDATE THESE TO YOUR ACTUAL PROVIDER)
const MODEL_PRICING = {
  "gpt-4o":       { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":  { input: 0.15,  output: 0.60  },
  "claude-sonnet":{ input: 3.00,  output: 15.00 },
  "default":      { input: 2.50,  output: 10.00 },
};

// Infrastructure amortized per-request (Netlify + Supabase + Resend)
// Tweak this number once you know your real monthly bill.
// Current guess: ~$64/mo @ 2,000 requests = $0.032/request ≈ 0.3 credits
const INFRA_FEE_CREDITS = 0.3;

// Your JS reconciliation engine fee (you deserve credit for your logic)
const RECONCILIATION_ENGINE = {
  baseCredits: 1.0,      // flat fee per reconciliation run
  perDocPairCredits: 0.15,
  maxEngineCredits: 4.0,
};

const MIN_CHARGE_CREDITS = 0.5;

// ── HELPERS ───────────────────────────────────────────

function getModelPricing(model = "default") {
  return MODEL_PRICING[model] || MODEL_PRICING.default;
}

function usdToCredits(usd) {
  return Math.ceil((usd / CREDIT_USD_VALUE) * 10) / 10;
}

function creditsToUsd(credits) {
  return credits * CREDIT_USD_VALUE;
}

// Raw AI cost in USD (zero-margin)
function calculateAICost(inputTokens, outputTokens, model = "default") {
  const rates = getModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  return inputCost + outputCost;
}

// Apply 60% margin: cost is 40% of final price
function applyMargin(costUsd) {
  return costUsd / 0.4;
}

// ── EXTRACTION ────────────────────────────────────────
function calculateExtractionCost({ inputTokens, outputTokens, model }) {
  const aiCostUsd = calculateAICost(inputTokens, outputTokens, model);
  const pricedUsd = applyMargin(aiCostUsd);
  const totalCredits = usdToCredits(pricedUsd) + INFRA_FEE_CREDITS;
  return Math.max(totalCredits, MIN_CHARGE_CREDITS);
}

function estimateExtractionCost(wordCount = 0, model = "default") {
  // Rough: 1 word ≈ 1.3 tokens input, output ≈ 25% of input
  const estInput = Math.ceil(wordCount * 1.3);
  const estOutput = Math.ceil(estInput * 0.25);
  return calculateExtractionCost({ inputTokens: estInput, outputTokens: estOutput, model });
}

// ── RECONCILIATION ────────────────────────────────────
function calculateReconciliationCost({
  aiInputTokens = 0,
  aiOutputTokens = 0,
  model = "default",
  docCountA = 0,
  docCountB = 0,
}) {
  const aiCostUsd = calculateAICost(aiInputTokens, aiOutputTokens, model);
  const pricedAiUsd = applyMargin(aiCostUsd);

  const pairs = Math.min(docCountA, docCountB);
  const engineCredits = Math.min(
    RECONCILIATION_ENGINE.baseCredits + (pairs * RECONCILIATION_ENGINE.perDocPairCredits),
    RECONCILIATION_ENGINE.maxEngineCredits
  );

  const totalCredits = usdToCredits(pricedAiUsd) + INFRA_FEE_CREDITS + engineCredits;
  return Math.max(totalCredits, MIN_CHARGE_CREDITS);
}

function estimateReconciliationCost(docCountA = 0, docCountB = 0) {
  const pairs = Math.min(docCountA, docCountB);
  const engineCredits = Math.min(
    RECONCILIATION_ENGINE.baseCredits + (pairs * RECONCILIATION_ENGINE.perDocPairCredits),
    RECONCILIATION_ENGINE.maxEngineCredits
  );
  return Math.max(INFRA_FEE_CREDITS + engineCredits, MIN_CHARGE_CREDITS);
}


// ── EXISTING: Wallet ops ──────────────────────────────
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
    .update({ credits_remaining: newBalance, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (upErr) return { success: false, error: upErr.message };

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

  if (txErr) console.warn(`[${feature}] Transaction log failed:`, txErr);

  return { success: true, balance: newBalance };
}

module.exports = {
  CREDIT_USD_VALUE,
  MODEL_PRICING,
  INFRA_FEE_CREDITS,
  RECONCILIATION_ENGINE,
  MIN_CHARGE_CREDITS,
  calculateAICost,
  calculateExtractionCost,
  calculateReconciliationCost,
  estimateExtractionCost,
  estimateReconciliationCost,
  getUserCredits,
  deductCredits,
};

