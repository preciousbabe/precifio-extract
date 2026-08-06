// netlify/functions/reconcile-run.js
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

function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function parseNumeric(v) {
  if (typeof v === "number") return v;
  if (!v) return null;
  let s = String(v).replace(/[^\d.()-]/g, "");
  const isNegative = s.includes("(") && s.includes(")");
  s = s.replace(/[()]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : (isNegative ? -n : n);
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.floor(Math.abs(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24));
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

// ─── Scoring Engine ───────────────────────────────────────
function scorePair(docA, docB, rules) {
  let totalScore = 0;
  let totalWeight = 0;
  const reasons = {};

  for (const rule of rules) {
    const valA = docA.extracted_fields?.[rule.side_a_field];
    const valB = docB.extracted_fields?.[rule.side_b_field];
    if (valA === undefined || valB === undefined) continue;

    let match = false, score = 0;

    switch (rule.strategy) {
      case "exact_with_tolerance": {
        const nA = parseNumeric(valA), nB = parseNumeric(valB);
        if (nA !== null && nB !== null) {
          const tol = rule.tolerance || 0;
          const diff = Math.abs(nA - nB);
          const pct = nA !== 0 ? diff / Math.abs(nA) : (nB === 0 ? 0 : 1);
          if (diff <= tol + 0.001 || pct <= (rule.tolerance_percent || 0) / 100) {
            match = true; score = 1;
          } else if (pct <= 0.05) {
            score = 0.7;
          } else if (pct <= 0.10) {
            score = 0.4;
          }
        }
        break;
      }
      case "date_proximity": {
        const dA = parseDate(valA), dB = parseDate(valB);
        if (dA && dB) {
          const dd = daysBetween(dA, dB);
          const tol = rule.tolerance || 7;
          if (dd <= tol) { match = true; score = 1; }
          else if (dd <= tol * 2) score = 0.5;
        }
        break;
      }
      case "normalized_exact": {
        const nA = normalize(valA), nB = normalize(valB);
        if (nA && nB) {
          if (nA === nB) { match = true; score = 1; }
          else if (similarity(nA, nB) >= 0.9) score = 0.8;
        }
        break;
      }
      case "fuzzy": {
        const sim = similarity(valA, valB);
        if (sim >= 0.9) { match = true; score = 1; }
        else if (sim >= 0.75) score = 0.7;
        else if (sim >= 0.6) score = 0.4;
        break;
      }
      default: {
        const sim = similarity(valA, valB);
        if (sim >= 0.9) { match = true; score = 1; }
        else if (sim >= 0.7) score = 0.6;
      }
    }

    totalScore += score * rule.weight;
    totalWeight += rule.weight;
    if (match || score >= 0.7) reasons[rule.canonical || rule.side_a_field] = true;
  }

  const normalizedScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  return { score: normalizedScore, reasons };
}


function findSubsetSum(items, target, tolAbs, amountField) {
  const valid = items
    .map((it) => ({ it, amt: parseNumeric(it.extracted_fields?.[amountField]) || 0 }))
    .filter((x) => x.amt > 0)
    .sort((a, b) => b.amt - a.amt);

  // 1. Greedy first (fast path)
  const greedy = [];
  let remaining = target;
  for (const x of valid) {
    if (remaining <= tolAbs) break;
    if (x.amt <= remaining + tolAbs) {
      greedy.push(x.it);
      remaining -= x.amt;
    }
  }
  if (greedy.length > 1 && Math.abs(remaining) <= tolAbs) return greedy;

  // 2. Try pairs (catches 50+50=100 when greedy picks 60 first)
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const sum = valid[i].amt + valid[j].amt;
      if (Math.abs(target - sum) <= tolAbs) return [valid[i].it, valid[j].it];
    }
  }

  // 3. Try triples
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (let k = j + 1; k < valid.length; k++) {
        const sum = valid[i].amt + valid[j].amt + valid[k].amt;
        if (Math.abs(target - sum) <= tolAbs) return [valid[i].it, valid[j].it, valid[k].it];
      }
    }
  }

  return null;
}

// ─── Greedy Matching with Sum Support ─────────────────────
function findMatches(docsA, docsB, rules, sumConfig) {
  const docAMatched = new Set();
  const docBMatched = new Set();
  const matches = [];

  // Phase 1: 1:1 exact matches (score >= 90)
  for (const a of docsA) {
    if (docAMatched.has(a.id)) continue;
    let best = null, bestScore = 0;
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const { score, reasons } = scorePair(a, b, rules);
      if (score > bestScore) { bestScore = score; best = { doc: b, score, reasons }; }
    }
    if (best && bestScore >= 90) {
      matches.push({ docA_id: a.id, docB_id: best.doc.id, type: "exact", score: bestScore, reasons: best.reasons });
      docAMatched.add(a.id);
      docBMatched.add(best.doc.id);
    }
  }

    // Phase 2: 1:N Sum matching (multiple Bs sum to one A)
  if (sumConfig?.enabled && sumConfig.side_a_amount_field && sumConfig.side_b_amount_field) {
    for (const a of docsA) {
      if (docAMatched.has(a.id)) continue;
      const target = parseNumeric(a.extracted_fields?.[sumConfig.side_a_amount_field]) || 0;
      if (!target) continue;

      const pool = docsB.filter(b => !docBMatched.has(b.id));
      const tolPct = (sumConfig.tolerance_percent || 0) / 100;
      const tolAbs = target * tolPct + 0.01;

      const subset = findSubsetSum(pool, target, tolAbs, sumConfig.side_b_amount_field);
      if (subset) {
        for (const b of subset) {
          matches.push({ docA_id: a.id, docB_id: b.id, type: "partial_sum", score: 85, reasons: { amount_sum: true } });
          docBMatched.add(b.id);
        }
        docAMatched.add(a.id);
      }
    }
  }


  // Phase 3: N:1 Sum matching (multiple As sum to one B)
  if (sumConfig?.enabled && sumConfig.side_a_amount_field && sumConfig.side_b_amount_field) {
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const target = parseNumeric(b.extracted_fields?.[sumConfig.side_b_amount_field]) || 0;
      if (!target) continue;

      const pool = docsA.filter(a => !docAMatched.has(a.id));
      const tolPct = (sumConfig.tolerance_percent || 0) / 100;
      const tolAbs = target * tolPct + 0.01;

      const subset = findSubsetSum(pool, target, tolAbs, sumConfig.side_a_amount_field);
      if (subset) {
        for (const a of subset) {
          matches.push({ docA_id: a.id, docB_id: b.id, type: "split", score: 80, reasons: { amount_split: true } });
          docAMatched.add(a.id);
        }
        docBMatched.add(b.id);
      }
    }
  }


  // Phase 4: Fuzzy / Review candidates (score 60-89)
  for (const a of docsA) {
    if (docAMatched.has(a.id)) continue;
    let best = null, bestScore = 0;
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const { score, reasons } = scorePair(a, b, rules);
      if (score > bestScore) { bestScore = score; best = { doc: b, score, reasons }; }
    }
    if (best && bestScore >= 60) {
      matches.push({ docA_id: a.id, docB_id: best.doc.id, type: bestScore >= 75 ? "strong" : "fuzzy", score: bestScore, reasons: best.reasons });
      docAMatched.add(a.id);
      docBMatched.add(best.doc.id);
    }
  }

  return { matches, docAMatched, docBMatched };
}

// ─── Main Handler ─────────────────────────────────────────
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});
  if (event.httpMethod !== "POST") return err(405, "Method not allowed");

  let workspaceLocked = false;
  let workspace_id;

  try {
    const auth = await getUser(event);
    if (auth.error) return err(auth.status, auth.error);
    const userId = auth.user.id;

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      return err(400, "Invalid JSON body");
    }
    ({ workspace_id } = body);
     if (!workspace_id) return err(400, "workspace_id required");

  const { data: ws } = await supabase
    .from("reconciliation_workspaces")
    .select("*")
    .eq("id", workspace_id)
    .eq("user_id", userId)
    .single();
  if (!ws) return err(404, "Workspace not found");

    // Lock workspace (idempotent)
  const { data: lockData } = await supabase.rpc("lock_workspace_for_processing", { p_workspace_id: workspace_id });
  if (!lockData) {
    return err(409, "Workspace is already processing or not found");
  }
  workspaceLocked = true;

  // Clear old matches
  await supabase.from("reconciliation_matches").delete().eq("workspace_id", workspace_id);
  await supabase.from("reconciliation_documents").update({ status: "unmatched", match_score: null }).eq("workspace_id", workspace_id);

  // Fetch both sides
  const { data: sideA } = await supabase
    .from("reconciliation_documents")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("dataset_side", "A");
  const { data: sideB } = await supabase
    .from("reconciliation_documents")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("dataset_side", "B");

  if (!sideA?.length || !sideB?.length) {
    await supabase.from("reconciliation_workspaces").update({ status: "completed" }).eq("id", workspace_id);
    return ok({ message: "Both sides need data to reconcile", summary: ws.summary });
  }

  // Get or generate config
  let config = ws.match_configuration;
  if (!config || !config.rules || config.auto_generated) {
    const aliasMap = await resolveFieldAliases(userId);
    const aFields = [...new Set(sideA.flatMap(d => Object.keys(d.extracted_fields || {})))];
    const bFields = [...new Set(sideB.flatMap(d => Object.keys(d.extracted_fields || {})))];
    config = autoGenerateMatchConfig(aFields, bFields, aliasMap);
    await supabase.from("reconciliation_workspaces").update({ match_configuration: config }).eq("id", workspace_id);
  }

  const { matches, docAMatched, docBMatched } = findMatches(sideA, sideB, config.rules || [], config.sum_matching || {});

    // Write matches with snapshots
  const docAMap = new Map(sideA.map(d => [d.id, d]));
  const docBMap = new Map(sideB.map(d => [d.id, d]));

  if (matches.length) {
    const inserts = matches.map(m => ({
      workspace_id,
      user_id: userId,
      document_id: m.docA_id,
      document_b_id: m.docB_id,
      match_type: m.type,
      match_score: m.score,
      status: m.score >= 90 ? "matched" : m.score >= 70 ? "review" : "partial",
      match_reasons: m.reasons,
      document_a_snapshot: docAMap.get(m.docA_id)?.extracted_fields || null,
      document_b_snapshot: docBMap.get(m.docB_id)?.extracted_fields || null,
    }));
    const { error: insErr } = await supabase.from("reconciliation_matches").insert(inserts);
    if (insErr) {
      console.error("match insert error:", insErr.message);
      return err(500, "Failed to save match results: " + insErr.message);
    }
  }

  // Update document statuses (bulk)
  const aStatusMap = new Map();
  const bStatusMap = new Map();
  for (const m of matches) {
    const st = m.score >= 90 ? "matched" : m.score >= 70 ? "review" : "partial";
    if (!aStatusMap.has(m.docA_id) || (st === "matched" && aStatusMap.get(m.docA_id).status !== "matched")) {
      aStatusMap.set(m.docA_id, { status: st, score: m.score });
    }
    if (!bStatusMap.has(m.docB_id) || (st === "matched" && bStatusMap.get(m.docB_id).status !== "matched")) {
      bStatusMap.set(m.docB_id, { status: st, score: m.score });
    }
  }

  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  const aUpdates = Array.from(aStatusMap, ([id, val]) => ({ id, status: val.status, match_score: val.score }));
  const bUpdates = Array.from(bStatusMap, ([id, val]) => ({ id, status: val.status, match_score: val.score }));

  for (const batch of chunk([...aUpdates, ...bUpdates], 100)) {
    const { error: upErr } = await supabase.from("reconciliation_documents").upsert(batch, { onConflict: "id" });
    if (upErr) {
      console.error("bulk doc update error:", upErr.message);
      return err(500, "Failed to update document statuses: " + upErr.message);
    }
  }

  // Summary (based on Side A)
  const { data: allDocs } = await supabase.from("reconciliation_documents").select("status, dataset_side").eq("workspace_id", workspace_id);
  const aDocs = allDocs.filter(d => d.dataset_side === "A");
  const summary = {
    matched: aDocs.filter(d => d.status === "matched").length,
    partial: aDocs.filter(d => d.status === "partial").length,
    review: aDocs.filter(d => d.status === "review").length,
    unmatched: aDocs.filter(d => d.status === "unmatched").length,
    total: aDocs.length,
  };

  await supabase.from("reconciliation_workspaces").update({ status: "completed", summary }).eq("id", workspace_id);
  return ok({ success: true, summary, matches_created: matches.length, configuration: config });

  } catch (e) {
    console.error("reconcile-run error:", e);
    return err(500, e.message || "Internal error during reconciliation");
  } finally {
    if (workspaceLocked) {
      // Only mark completed if we haven't already returned an error
      // (Success path already updated status+summary above)
    }
  }
};