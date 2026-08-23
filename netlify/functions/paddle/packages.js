// netlify/functions/paddle/packages

"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE PACKAGE AUTHORITY
 * ============================================================
 *
 * BACKEND ONLY. Frontend never determines credits.
 *
 * TODO: Replace placeholder price IDs below with your actual
 * Paddle Price IDs before going live.
 * ============================================================
 */

const PADDLE_PRICE_MAP = Object.freeze({
  /**
   * Quick Top-up — 50 Credits ($5.00)
   * TODO: Replace with your real Paddle price ID
   */
  "pri_01m0grh8nkhztk13vfybh50h48": Object.freeze({
    packageId: "mini",
    credits: 50,
    priceCents: 500,
    expectedAmount: "500",
    expectedCurrency: "USD",
    description: "Precifio Quick Top-up — 50 Credits",
  }),
  /**
   * Starter — 100 Credits ($10.00)
   */
  "pri_01m07w0he8my3apktgrdt9a6jj": Object.freeze({
    packageId: "starter",
    credits: 100,
    priceCents: 1000,
    expectedAmount: "1000",
    expectedCurrency: "USD",
    description: "Precifio Starter — 100 Credits",
  }),

  /**
   * Growth — 275 Credits ($25.00)
   * TODO: Replace placeholder with your real Paddle price ID
   */
  "pri_01m0gs41hp5ezmqvd8qxr8evbd": Object.freeze({
    packageId: "growth",
    credits: 275,
    priceCents: 2500,
    expectedAmount: "2500",
    expectedCurrency: "USD",
    description: "Precifio Growth — 275 Credits",
  }),
  /**
   * Business — 600 Credits ($50.00)
   * TODO: Replace placeholder with your real Paddle price ID
   */
  "pri_01m0gs7y2ggxt3zhfp4n0fd7qb": Object.freeze({
    packageId: "business",
    credits: 600,
    priceCents: 5000,
    expectedAmount: "5000",
    expectedCurrency: "USD",
    description: "Precifio Business — 600 Credits",
  }),

  /**
   * Enterprise — 1,300 Credits ($100.00)
   * TODO: Replace placeholder with your real Paddle price ID
   */
  "pri_01m0gsc000dq2seffn072h0app": Object.freeze({
    packageId: "enterprise",
    credits: 1300,
    priceCents: 10000,
    expectedAmount: "10000",
    expectedCurrency: "USD",
    description: "Precifio Enterprise — 1,300 Credits",
  }),
});


function getPackageByPriceId(priceId) {
  if (!priceId || typeof priceId !== "string") return null;
  return PADDLE_PRICE_MAP[priceId] || null;
}


function isKnownPaddlePrice(priceId) {
  return Boolean(getPackageByPriceId(priceId));
}


/**
 * Lookup by our internal package ID (starter, growth, etc).
 * Returns { priceId, packageId, credits, ... } or null.
 */
function getPackageById(packageId) {
  if (!packageId || typeof packageId !== "string") return null;
  const entry = Object.entries(PADDLE_PRICE_MAP).find(([, p]) => p.packageId === packageId);
  if (!entry) return null;
  return { priceId: entry[0], ...entry[1] };
}


module.exports = {
  PADDLE_PRICE_MAP,
  getPackageByPriceId,
  isKnownPaddlePrice,
  getPackageById,
};