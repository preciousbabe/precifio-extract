// netlify/functions/paddle-checkout.js
"use strict";

const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const { getSupabaseAdmin } = require("./paddle/supabase");
const { getPackageById } = require("./paddle/packages");

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

let paddleClient = null;

function getPaddle() {
  if (paddleClient) return paddleClient;

  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY is not configured.");

  const isProduction =
    String(process.env.PADDLE_ENVIRONMENT || "sandbox").trim().toLowerCase() ===
    "production";

  paddleClient = new Paddle(apiKey, {
    environment: isProduction ? Environment.production : Environment.sandbox,
  });

  return paddleClient;
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
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      return response(400, { error: "Invalid JSON body" });
    }

    const packageId = body.package_id;
    const pkg = getPackageById(packageId);
    if (!pkg) return response(400, { error: "Invalid package" });

    // ── Determine environment early (needed for URL construction) ──
    const isProduction =
      String(process.env.PADDLE_ENVIRONMENT || "sandbox").trim().toLowerCase() ===
      "production";

    const siteUrl = process.env.SITE_URL || "http://localhost:8888";

    // ── Create Paddle transaction via SDK ──
    const paddle = getPaddle();

    const transaction = await paddle.transactions.create({
      items: [{ priceId: pkg.priceId, quantity: 1 }],
      customer: { email: user.email },
      customData: {
        user_id: user.id,
        package_id: pkg.packageId,
      },
      returnUrl: `${siteUrl}/credits/success`,
    });

    console.log("Paddle transaction created:", JSON.stringify(transaction, null, 2));

    // ── Build the correct hosted checkout URL ──
    // Paddle sometimes returns the merchant domain in checkout.url.
    // The hosted checkout always lives on Paddle's domain with ?_ptxn=<id>
    const hostedCheckoutDomain = isProduction
      ? "https://checkout.paddle.com"
      : "https://sandbox-checkout.paddle.com";

    const checkoutUrl = `${hostedCheckoutDomain}/?_ptxn=${transaction.id}`;

    console.log("Redirecting to Paddle checkout:", checkoutUrl);

   return response(200, {
  transaction_id: transaction.id,   
  package_id: pkg.packageId,
});

  } catch (err) {
    console.error("Checkout error:", err);
    return response(500, { error: err.message || "Checkout creation failed" });
  }
};