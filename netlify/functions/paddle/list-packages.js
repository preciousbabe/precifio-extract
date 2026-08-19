// netlify/functions/paddle/list-packages.js
"use strict";

const { PADDLE_PRICE_MAP } = require("./packages");

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  try {
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
  } catch (err) {
    console.error("list-packages error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: err.message, packages: [] }),
    };
  }
};