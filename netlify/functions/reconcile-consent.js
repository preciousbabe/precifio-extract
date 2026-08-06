// netlify/functions/reconcile-consent.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

function err(status, message, extra = {}) {
  return { statusCode: status, headers: CORS, body: JSON.stringify({ error: message, ...extra }) };
}

async function getUser(event) {
  const token = event.headers.authorization?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized", status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: "Invalid token", status: 401 };
  return { user: data.user };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});

  const auth = await getUser(event);
  if (auth.error) return err(auth.status, auth.error);
  const userId = auth.user.id;

  if (event.httpMethod === "GET") {
    const { data } = await supabase
      .from("reconciliation_user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    return ok({ consent_granted: !!data?.consent_granted, settings: data || null });
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const { consent_granted, match_settings } = body;

    const payload = {
      user_id: userId,
      consent_granted: consent_granted === true,
      consent_granted_at: consent_granted === true ? new Date().toISOString() : null,
      ...(match_settings && { default_match_settings: match_settings }),
    };

    const { data, error } = await supabase
      .from("reconciliation_user_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) return err(500, error.message);
    return ok({ consent_granted: data.consent_granted, settings: data });
  }

  return err(405, "Method not allowed");
};