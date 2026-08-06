// netlify/functions/reconcile-configure.js
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

// ─── String / Math Utilities ──────────────────────────────
function levenshtein(a, b) {
  const m = [], n = a.length, p = b.length;
  if (!n) return p; if (!p) return n;
  for (let i = 0; i <= p; i++) m[i] = [i];
  for (let j = 0; j <= n; j++) m[0][j] = j;
  for (let i = 1; i <= p; i++)
    for (let j = 1; j <= n; j++)
      m[i][j] = b[i - 1] === a[j - 1] ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[p][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const s1 = String(a).toLowerCase().trim();
  const s2 = String(b).toLowerCase().trim();
  if (s1 === s2) return 1;
  const d = levenshtein(s1, s2), mx = Math.max(s1.length, s2.length);
  return mx === 0 ? 1 : 1 - d / mx;
}


function canonicalizeFieldName(raw, aliasMap) {
  const key = String(raw).toLowerCase().trim();
  return aliasMap.get(key)?.canonical || key;
}

function detectFieldType(key, aliasMap) {
  const lower = key.toLowerCase();
  if (aliasMap.has(lower)) return aliasMap.get(lower).type;
  if (/date|time|day|month|year/.test(lower)) return "date";
  // reference BEFORE numeric so "reference" and "invoice_ref" don't become numeric
  if (/ref|reference|invoice\s*#?|po\s*#?|order\s*#?|transaction\s*#?|check\s*#?|cheque\s*#?/.test(lower)) return "reference";
  if (/amount|total|sum|price|cost|value|payment|paid|due|balance|qty|quantity/.test(lower)) return "numeric";
  return "text";
}


async function resolveFieldAliases(userId) {
  const { data } = await supabase
    .from("reconciliation_field_aliases")
    .select("canonical_name, aliases, field_type")
    .eq("user_id", userId);
  const map = new Map();
  for (const row of (data || [])) {
    for (const alias of row.aliases) {
      map.set(alias.toLowerCase(), { canonical: row.canonical_name, type: row.field_type });
    }
    map.set(row.canonical_name.toLowerCase(), { canonical: row.canonical_name, type: row.field_type });
  }
  return map;
}


function autoGenerateMatchConfig(sideAFields, sideBFields, aliasMap) {
  const aCanon = sideAFields.map(f => ({ raw: f, canon: canonicalizeFieldName(f, aliasMap) }));
  const bCanon = sideBFields.map(f => ({ raw: f, canon: canonicalizeFieldName(f, aliasMap) }));

  const rules = [];
  const usedB = new Set();

  for (const af of aCanon) {
    const exact = bCanon.find(bf => bf.canon === af.canon && !usedB.has(bf.raw));
    if (exact) {
      const type = detectFieldType(af.canon, aliasMap);
      const weight = type === "numeric" ? 0.35 : type === "date" ? 0.25 : type === "reference" ? 0.25 : 0.15;
      rules.push({
        side_a_field: af.raw,
        side_b_field: exact.raw,
        canonical: af.canon,
        type,
        weight,
        tolerance: type === "numeric" ? 0.01 : type === "date" ? 7 : null,
        strategy: type === "numeric" ? "exact_with_tolerance" : type === "date" ? "date_proximity" : type === "reference" ? "normalized_exact" : "fuzzy"
      });
      usedB.add(exact.raw);
      continue;
    }


    const fuzzy = bCanon.find(bf => similarity(af.canon, bf.canon) >= 0.75 && !usedB.has(bf.raw));
    if (fuzzy) {
      const type = detectFieldType(af.canon, aliasMap);
      rules.push({
        side_a_field: af.raw,
        side_b_field: fuzzy.raw,
        canonical: af.canon,
        type,
        weight: 0.15,
        tolerance: type === "numeric" ? 0.05 : type === "date" ? 14 : null,
        strategy: "fuzzy"
      });
      usedB.add(fuzzy.raw);
    }
  }

  const amountRules = rules.filter(r => r.type === "numeric" && /amount|total|sum|payment|paid|due/.test(r.canon));
  const hasAmount = amountRules.length > 0;

  return {
    rules,
    sum_matching: {
      enabled: hasAmount,
      side_a_amount_field: amountRules[0]?.side_a_field || null,
      side_b_amount_field: amountRules[0]?.side_b_field || null,
      tolerance_percent: 0
    },
    auto_generated: true,
    generated_at: new Date().toISOString()
  };
}


exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});

  const auth = await getUser(event);
  if (auth.error) return err(auth.status, auth.error);
  const userId = auth.user.id;

  if (event.httpMethod === "GET") {
    const { workspace_id } = event.queryStringParameters || {};
    if (!workspace_id) return err(400, "workspace_id required");

    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("match_configuration")
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .single();
    if (!ws) return err(404, "Workspace not found");

    if (ws.match_configuration && !ws.match_configuration.auto_generated) {
      return ok({ configuration: ws.match_configuration, auto_generated: false });
    }

    const [{ data: sideA }, { data: sideB }] = await Promise.all([
      supabase.rpc("get_workspace_fields", { p_workspace_id: workspace_id, p_side: "A" }),
      supabase.rpc("get_workspace_fields", { p_workspace_id: workspace_id, p_side: "B" }),
    ]);

    const aliasMap = await resolveFieldAliases(userId);
    const config = autoGenerateMatchConfig(
      (sideA || []).map(r => r.field_key),
      (sideB || []).map(r => r.field_key),
      aliasMap
    );

    await supabase
      .from("reconciliation_workspaces")
      .update({ match_configuration: config })
      .eq("id", workspace_id);

    return ok({ configuration: config, auto_generated: true });
  }

  if (event.httpMethod === "POST") {
    const { workspace_id, configuration } = JSON.parse(event.body || "{}");
    if (!workspace_id || !configuration) return err(400, "workspace_id and configuration required");

    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("id")
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .single();
    if (!ws) return err(404, "Workspace not found");

    configuration.auto_generated = false;
    configuration.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("reconciliation_workspaces")
      .update({ match_configuration: configuration })
      .eq("id", workspace_id);

    if (error) return err(500, error.message);
    return ok({ configuration });
  }

  return err(405, "Method not allowed");
};