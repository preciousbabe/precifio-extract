"use strict";

/**
 * ============================================================
 * PRECIFIO — PUBLIC PACKAGE LIST
 * ============================================================
 *
 * Netlify Function:
 * /.netlify/functions/paddle/list-packages
 *
 * Returns sanitized package data for the frontend.
 * No authentication required.
 * ============================================================
 */

const { PADDLE_PRICE_MAP } = require("./packages");

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const packages = Object.entries(PADDLE_PRICE_MAP).map(([priceId, pkg]) => ({
    id: pkg.packageId,
    credits: pkg.credits,
    priceCents: pkg.priceCents,
    label: pkg.description.replace("Precifio ", "").split(" — ")[0],
    description: `${pkg.credits} AI Credits`,
    pricePerCredit: `$${(pkg.priceCents / 100 / pkg.credits).toFixed(2)} per credit`,
    popular: pkg.packageId === "growth",
  }));

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ packages }),
  };
};