// netlify/functions/reconcile-workspace.js
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
    const { workspace_id } = event.queryStringParameters || {};
    if (workspace_id) {
      const { data, error } = await supabase
        .from("reconciliation_workspaces")
        .select(`*, docs:reconciliation_documents(count), txns:reconciliation_documents(count)`)
        .eq("id", workspace_id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();
      if (error || !data) return err(404, "Workspace not found");
      return ok({ workspace: data });
    }
  
    
        const { page = "1", limit = "50" } = event.queryStringParameters || {};
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const from = (pageNum - 1) * pageSize;

    const { data, error, count } = await supabase
      .from("reconciliation_workspaces")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return err(500, error.message);
    return ok({ workspaces: data, page: pageNum, page_size: pageSize, total: count });
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const { name, date_from, date_to, match_settings } = body;

    const { data: settings } = await supabase
      .from("reconciliation_user_settings")
      .select("consent_granted_at, default_match_settings")
      .eq("user_id", userId)
      .single();

    if (!settings?.consent_granted_at) {
      return err(403, "Reconciliation consent not granted", { code: "CONSENT_REQUIRED" });
    }

    const { data, error } = await supabase
      .from("reconciliation_workspaces")
      .insert({
        user_id: userId,
        name: name || `Reconciliation ${new Date().toLocaleDateString()}`,
        date_from: date_from || null,
        date_to: date_to || null,
        match_configuration: match_settings || settings.default_match_settings || {},
        consent_granted_at: settings.consent_granted_at,
      })
      .select()
      .single();

    if (error) return err(500, error.message);
    return ok({ workspace: data });
  }

  if (event.httpMethod === "DELETE") {
    const { workspace_id } = JSON.parse(event.body || "{}");
    const { error } = await supabase
      .from("reconciliation_workspaces")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", workspace_id)
      .eq("user_id", userId);
    if (error) return err(500, error.message);
    return ok({ success: true });
  }

  return err(405, "Method not allowed");
};