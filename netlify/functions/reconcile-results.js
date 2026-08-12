// netlify/functions/reconcile-results.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  if (event.httpMethod !== "GET") return err(405, "Method not allowed");

  const auth = await getUser(event);
  if (auth.error) return err(auth.status, auth.error);
  const userId = auth.user.id;

  const { workspace_id, status, side } = event.queryStringParameters || {};
  if (!workspace_id) return err(400, "workspace_id required");

  const { data: ws } = await supabase
    .from("reconciliation_workspaces")
    .select("*, last_rejected_candidates")
    .eq("id", workspace_id)
    .eq("user_id", userId)
    .single();
  if (!ws) return err(404, "Workspace not found");

    const { limit = "200" } = event.queryStringParameters || {};
  const docLimit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 200));

  let docQuery = supabase.from("reconciliation_documents").select("*").eq("workspace_id", workspace_id);
  if (status) docQuery = docQuery.eq("status", status);
  if (side) docQuery = docQuery.eq("dataset_side", side);

      try {
    const [{ data: documents }, { data: matches }] = await Promise.all([
      docQuery.order("created_at", { ascending: true }).limit(docLimit),
      supabase.from("reconciliation_matches").select("*").eq("workspace_id", workspace_id).limit(docLimit),
    ]);
    return ok({ workspace: ws, documents: documents || [], matches: matches || [] });
  } catch (e) {
    return err(500, "Failed to fetch results", { detail: e.message });
  }
};

