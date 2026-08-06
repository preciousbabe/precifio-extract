// netlify/functions/reconcile-delete-all.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    // 1. Delete workspaces first — CASCADE handles documents and matches
  const { error: wsDelErr } = await supabase
    .from("reconciliation_workspaces")
    .delete()
    .eq("user_id", userId);

  if (wsDelErr) return err(500, wsDelErr.message);

  // 2. Delete aliases
  const { error: aErr } = await supabase
    .from("reconciliation_field_aliases")
    .delete()
    .eq("user_id", userId);
  if (aErr) return err(500, aErr.message);

  // 3. Delete user settings
  const { error: sErr } = await supabase
    .from("reconciliation_user_settings")
    .delete()
    .eq("user_id", userId);
  if (sErr) return err(500, sErr.message);

  return ok({ deleted: true });
};