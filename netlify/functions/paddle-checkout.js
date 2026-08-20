"use strict";

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

    // ── Return validated price for client-side checkout ──
    return response(200, {
      price_id: pkg.priceId,
      package_id: pkg.packageId,
      user_email: user.email,
    });

  } catch (err) {
    console.error("Checkout error:", err);
    return response(500, { error: err.message || "Checkout initialization failed" });
  }
};