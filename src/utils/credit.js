// src/utils/credits.js

// ── EXTRACTION BURN RATES ─────────────────────────────
const EXTRACTION_RATES = {
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

// ── RECONCILIATION BURN RATES (affordable) ────────────
const RECONCILIATION_RATES = {
  per_document: 0.15,
  per_match:    0.10,
  base:         0.50,
  min_charge:   0.50,
  max_charge:   25.00,
};

const XERO_QB_TRANSFORM_COST = 0.3;
const MINIMUM_CHARGE = 0.5;

// ── EXTRACTION ──
export function estimateExtractionCost(documentType = 'generic', pageCount = 1) {
  const rate = EXTRACTION_RATES[documentType] || EXTRACTION_RATES.generic;
  const estimated = Math.round(rate.base * pageCount * 10) / 10;
  return Math.max(estimated, MINIMUM_CHARGE);
}

export function calculateExtractionCost(documentType, tokensUsed, exportFormat = null) {
  const rate = EXTRACTION_RATES[documentType] || EXTRACTION_RATES.generic;
  const tokenCost = (tokensUsed / 1000) * 0.5;
  let cost = Math.max(rate.base, Math.min(tokenCost, rate.max));
  if (exportFormat === 'xero' || exportFormat === 'quickbooks') {
    cost += XERO_QB_TRANSFORM_COST;
  }
  return Math.max(Math.round(cost * 10) / 10, MINIMUM_CHARGE);
}

// ── RECONCILIATION ──
export function estimateReconciliationCost(sideACount, sideBCount) {
  const r = RECONCILIATION_RATES;
  const docCost = (sideACount + sideBCount) * r.per_document;
  const estimated = r.base + docCost;
  return Math.min(Math.max(Math.round(estimated * 10) / 10, r.min_charge), r.max_charge);
}

export function calculateReconciliationCost(sideACount, sideBCount, matchCount = 0) {
  const r = RECONCILIATION_RATES;
  const docCost = (sideACount + sideBCount) * r.per_document;
  const matchCost = matchCount * r.per_match;
  const total = r.base + docCost + matchCost;
  return Math.min(Math.max(Math.round(total * 10) / 10, r.min_charge), r.max_charge);
}

export function getBurnRates() {
  return {
    extraction: EXTRACTION_RATES,
    reconciliation: RECONCILIATION_RATES,
  };
}