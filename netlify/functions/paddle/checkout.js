"use strict";

/**
 * ============================================================
 * PRECIFIO — PADDLE CHECKOUT CREATION
 * ============================================================
 *
 * Netlify Function:
 * /.netlify/functions/paddle/checkout
 *
 * Responsibilities:
 * 1. Authenticate the Precifio user
 * 2. Validate the requested package_id against packages.js
 * 3. Create a Paddle transaction (backend → Paddle API)
 * 4. Return the checkout URL to the frontend
 *
 * The frontend NEVER touches Paddle directly.
 * ============================================================
 */

const { getSupabaseAdmin } = require("./supabase");
const { getPackageById } = require("./packages");
const { PADDLE_API_BASE_URL } = require("./config");

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  if (event.httpMethod === "OPTIONS") return response(204, {});
  if (event.httpMethod !== "POST") return response(405, { error: "Method not allowed" });

  try {
    // ── Auth ──
    const token = (event.headers.authorization || event.headers.Authorization || "").replace("Bearer ", "");
    if (!token) return response(401, { error: "Unauthorized" });

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return response(401, { error: "Invalid token" });

    // ── Validate package ──
    const body = JSON.parse(event.body || "{}");
    const packageId = body.package_id;

    const pkg = getPackageById(packageId);
    if (!pkg) return response(400, { error: "Invalid package" });

    // ── Create Paddle transaction ──
    const paddleRes = await fetch(`${PADDLE_API_BASE_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PADDLE_API_KEY}`,
      },
      body: JSON.stringify({
        items: [{ price_id: pkg.priceId, quantity: 1 }],
        customer: { email: user.email },
        custom_data: {
          user_id: user.id,
          package_id: pkg.packageId,
        },
        return_url: `${process.env.SITE_URL || "http://localhost:8888"}/credits/success`,
      }),
    });

    const paddleData = await paddleRes.json();

    if (!paddleRes.ok) {
      console.error("Paddle checkout error:", paddleData);
      return response(500, { error: "Checkout creation failed" });
    }

    return response(200, {
      checkout_url: paddleData.data?.checkout?.url,
      transaction_id: paddleData.data?.id,
    });

  } catch (err) {
    console.error("Checkout error:", err);
    return response(500, { error: err.message });
  }
};