// src/utils/credits.js

// Internal burn rates — NEVER expose these to the UI directly
const BURN_RATES = {
  receipt:         { base: 0.7,  max: 1.2,  label: 'Receipt' },
  invoice:         { base: 1.2,  max: 2.0,  label: 'Invoice' },
  purchase_order:  { base: 1.6,  max: 3.0,  label: 'Purchase Order' },
  bank_statement:  { base: 4.8,  max: 8.0,  label: 'Bank Statement' },
  insurance_claim: { base: 7.2,  max: 12.0, label: 'Insurance Claim' },
  medical_report:  { base: 8.5,  max: 14.0, label: 'Medical Report' },
  passport:        { base: 0.9,  max: 1.5,  label: 'Passport' },
  drivers_license: { base: 0.8,  max: 1.4,  label: "Driver's Licence" },
  generic:         { base: 1.0,  max: 2.0,  label: 'Document' },
};

const XERO_QB_TRANSFORM_COST = 0.3;
const MINIMUM_CHARGE = 0.5;

/**
 * Estimate cost BEFORE processing (shown to user)
 */
export function estimateCost(documentType = 'generic', pageCount = 1) {
  const rate = BURN_RATES[documentType] || BURN_RATES.generic;
  // Simple estimation: base * pages, rounded to 1 decimal
  const estimated = Math.round(rate.base * pageCount * 10) / 10;
  return Math.max(estimated, MINIMUM_CHARGE);
}

/**
 * Calculate actual cost AFTER processing (server-side truth)
 * This should run in your Netlify function, not the client
 */
export function calculateActualCost(documentType, tokensUsed, exportFormat = null) {
  const rate = BURN_RATES[documentType] || BURN_RATES.generic;
  
  // Base cost from token burn (approximate)
  const tokenCost = (tokensUsed / 1000) * 0.5; // 0.5 credits per 1K tokens
  
  // Clamp between base and max for the document type
  let cost = Math.max(rate.base, Math.min(tokenCost, rate.max));
  
  // Add transform cost for accounting exports
  if (exportFormat === 'xero' || exportFormat === 'quickbooks') {
    cost += XERO_QB_TRANSFORM_COST;
  }
  
  return Math.max(Math.round(cost * 10) / 10, MINIMUM_CHARGE);
}

/**
 * Get all burn rates for admin dashboard
 */
export function getBurnRates() {
  return BURN_RATES;
}