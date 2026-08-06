// netlify/functions/reconcile-field-aliases.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    const { data, error } = await supabase
      .from("reconciliation_field_aliases")
      .select("*")
      .eq("user_id", userId);
    if (error) return err(500, error.message);
    return ok({ aliases: data || [] });
  }

  if (event.httpMethod === "POST") {
    const { canonical_name, aliases, field_type } = JSON.parse(event.body || "{}");
    if (!canonical_name || !Array.isArray(aliases) || aliases.length === 0) {
      return err(400, "canonical_name and aliases array required");
    }
    const { data, error } = await supabase
      .from("reconciliation_field_aliases")
      .upsert({ user_id: userId, canonical_name, aliases, field_type: field_type || "text" }, { onConflict: "user_id, canonical_name" })
      .select()
      .single();
    if (error) return err(500, error.message);
    return ok({ alias: data });
  }

  if (event.httpMethod === "DELETE") {
    const { id } = JSON.parse(event.body || "{}");
    const { error } = await supabase.from("reconciliation_field_aliases").delete().eq("id", id).eq("user_id", userId);
    if (error) return err(500, error.message);
    return ok({ deleted: true });
  }

  return err(405, "Method not allowed");
};