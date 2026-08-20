// netlify/functions/reconcile-process-queue.js
const { createClient } = require("@supabase/supabase-js");
const {
  calculateReconciliationCost,
  estimateReconciliationCost,
  getUserCredits,
  deductCredits,
} = require("./lib/credits");
const core = require("./lib/reconcile-core");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify(body) };
}

function err(status, code, message, extra = {}) {
  return {
    statusCode: status,
    headers: CORS,
    body: JSON.stringify({ error: { code, message, ...extra } }),
  };
}

class ReconciliationError extends Error {
  constructor(code, message, recoverable = false) {
    super(message);
    this.code = code;
    this.recoverable = recoverable;
  }
}

async function getUser(event) {
  const token = event.headers.authorization?.replace("Bearer ", "");
  if (!token) throw new ReconciliationError("UNAUTHORIZED", "Missing authorization header");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ReconciliationError("UNAUTHORIZED", "Invalid token");
  return data.user;
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

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return ok({});
  if (event.httpMethod !== "POST") return err(405, "METHOD_NOT_ALLOWED", "Method not allowed");

  let workspaceLocked = false;
  let workspace_id = null;

  try {
    const auth = await getUser(event);
    const userId = auth.id;
    const body = JSON.parse(event.body || "{}");

    // Find the oldest queued run for this user
    let runQuery = supabase
      .from("reconciliation_runs")
      .select("*, workspace:workspace_id(*)")
      .eq("status", "queued")
      .order("created_at", { ascending: true });

    if (body.run_id) {
      runQuery = runQuery.eq("id", body.run_id);
    }

    const { data: runRecord, error: runErr } = await runQuery.limit(1).single();

    if (runErr || !runRecord) {
      return ok({ message: "No queued jobs found", processed: false });
    }

    workspace_id = runRecord.workspace_id;

    // Verify ownership
    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("*")
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .single();

    if (!ws) return err(404, "NOT_FOUND", "Workspace not found");

    // Lock workspace
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: lockData, error: lockErr } = await supabase
      .from("reconciliation_workspaces")
      .update({ is_processing: true, processing_started_at: new Date().toISOString() })
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .or(`is_processing.eq.false,processing_started_at.lt.${lockTimeout}`)
      .select("id")
      .single();

    if (lockErr || !lockData) {
      return err(409, "ALREADY_PROCESSING", "Workspace is locked by another process");
    }
    workspaceLocked = true;

    await supabase.from("reconciliation_runs").update({ status: "running" }).eq("id", runRecord.id);

    // Clear old matches and reset statuses
    await supabase.from("reconciliation_matches").delete().eq("workspace_id", workspace_id);
    await supabase
      .from("reconciliation_documents")
      .update({ status: "unmatched", match_score: null })
      .eq("workspace_id", workspace_id);

        // Fetch docs
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

        const normalizeDoc = (doc) => {
      let fields = doc.extracted_fields || {};
      let name = doc.document_name;
      while (
        fields &&
        fields.extracted_fields &&
        typeof fields.extracted_fields === "object" &&
        !Array.isArray(fields.extracted_fields)
      ) {
        name = fields.document_name || name;
        fields = { ...fields.extracted_fields };
      }
      
              // Fix 5: Extract embedded references from all text fields
      const allText = Object.values(fields).filter(v => typeof v === "string" && v.length > 3).join(" ");
      const extractedRefs = core.extractEmbeddedReferences(allText);
      if (extractedRefs.length > 0) {
        fields.__extracted_refs = extractedRefs;
      }
      
      return { ...doc, document_name: name, extracted_fields: fields };
    };
    const normalizedSideA = (sideA || []).map(normalizeDoc);
    const normalizedSideB = (sideB || []).map(normalizeDoc);

       if (!normalizedSideA.length || !normalizedSideB.length) {
      await supabase.from("reconciliation_workspaces").update({ status: "completed", is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      await supabase.from("reconciliation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runRecord.id);
      return ok({ message: "Both sides need data to reconcile", summary: ws.summary, processed: true });
    }

    // ─── CREDIT CHECK ─────────────────────────────────────────────────────
    const sideACount = normalizedSideA.length;
    const sideBCount = normalizedSideB.length;
    const estimatedCost = estimateReconciliationCost(sideACount, sideBCount);
    const userBalance = await getUserCredits(supabase, userId);

    if (userBalance < estimatedCost) {
      await supabase.from("reconciliation_runs").update({ status: "failed", error_message: "Insufficient credits", completed_at: new Date().toISOString() }).eq("id", runRecord.id);
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      workspaceLocked = false;
      return err(402, "PAYMENT_REQUIRED", `Insufficient credits. This run requires ~${estimatedCost} credits. Your balance: ${userBalance}.`, { required: estimatedCost, balance: userBalance });
    }


    // Get or generate config
    let config = ws.match_configuration;
    if (!config || !config.rules || config.auto_generated) {
      const aliasMap = await resolveFieldAliases(userId);
           const aFields = [...new Set(normalizedSideA.flatMap(d => Object.keys(d.extracted_fields || {}).filter(k => !k.startsWith("__"))))];
      const bFields = [...new Set(normalizedSideB.flatMap(d => Object.keys(d.extracted_fields || {}).filter(k => !k.startsWith("__"))))];
      config = core.autoGenerateMatchConfig(aFields, bFields, aliasMap, normalizedSideA, normalizedSideB);

      const configValid = core.validateConfig(config);
      if (!configValid.valid) {
        throw new ReconciliationError("CONFIG_ERROR", configValid.error);
      }
      await supabase.from("reconciliation_workspaces").update({ match_configuration: config }).eq("id", workspace_id);
    }

      const { matches, docAMatched, docBMatched, rejectedCandidates, unmatchedReports } = core.findMatches(
      normalizedSideA,
      normalizedSideB,
      config.rules || [],
      config.sum_matching || {},
      () => {} // silent logger for queue
    );

        // Optional OpenAI narrative enhancement
    const openaiKey = process.env.OPENAI_API_KEY;
    let aiInputTokens = 0;
    let aiOutputTokens = 0;
    if (openaiKey) {
      for (const m of matches) {
        if (m.investigative_report) {
          const result = await core.enhanceReportWithOpenAI(m.investigative_report, openaiKey);
          m.investigative_report = result.report;
          aiInputTokens += result.usage?.prompt_tokens || 0;
          aiOutputTokens += result.usage?.completion_tokens || 0;
        }
      }
    }


    // Write matches
    const docAMap = new Map(normalizedSideA.map(d => [d.id, d]));
    const docBMap = new Map(normalizedSideB.map(d => [d.id, d]));

    if (matches.length) {
      const inserts = matches.map(m => ({
        workspace_id,
        user_id: userId,
        document_id: m.docA_id,
        document_b_id: m.docB_id,
        match_type: m.type,
        match_score: m.score,
        status: m.status,
        match_reasons: m.reasons,
        gate_failures: m.gate_failures || [],
        warnings: m.warnings || [],
        document_a_snapshot: docAMap.get(m.docA_id)?.extracted_fields || null,
        document_b_snapshot: docBMap.get(m.docB_id)?.extracted_fields || null,
        investigative_report: m.investigative_report || null,
      }));
      const { error: insErr } = await supabase.from("reconciliation_matches").insert(inserts);
      if (insErr) throw new ReconciliationError("INSERT_ERROR", "Failed to save matches: " + insErr.message);
    }

    // Bulk update document statuses
    const aStatusMap = new Map();
    const bStatusMap = new Map();
    for (const m of matches) {
      const st = m.status;
      if (!aStatusMap.has(m.docA_id) || (st === "matched" && aStatusMap.get(m.docA_id).status !== "matched")) {
        aStatusMap.set(m.docA_id, { status: st, score: m.score });
      }
      if (!bStatusMap.has(m.docB_id) || (st === "matched" && bStatusMap.get(m.docB_id).status !== "matched")) {
        bStatusMap.set(m.docB_id, { status: st, score: m.score });
      }
    }
    const updateGroups = new Map();
    for (const [id, val] of [...aStatusMap, ...bStatusMap]) {
      const key = `${val.status}:${val.score}`;
      if (!updateGroups.has(key)) updateGroups.set(key, { status: val.status, score: val.score, ids: [] });
      updateGroups.get(key).ids.push(id);
    }
    for (const group of updateGroups.values()) {
      await supabase.from("reconciliation_documents").update({ status: group.status, match_score: group.score }).in("id", group.ids);
    }

        // Fix 3: Persist unmatched analysis
    if (unmatchedReports?.length > 0) {
      for (const u of unmatchedReports) {
        await supabase.from("reconciliation_documents")
          .update({ unmatched_analysis: u.report })
          .eq("id", u.docId);
      }
    }

    
    // Summary
    const { data: allDocs } = await supabase.from("reconciliation_documents").select("status, dataset_side").eq("workspace_id", workspace_id);
    const aDocs = allDocs.filter(d => d.dataset_side === "A");
    const summary = {
      matched: aDocs.filter(d => d.status === "matched").length,
      partial: aDocs.filter(d => d.status === "partial").length,
      review: aDocs.filter(d => d.status === "review").length,
      unmatched: aDocs.filter(d => d.status === "unmatched").length,
      total: aDocs.length,
    };

        // ─── DEDUCT ACTUAL CREDITS ────────────────────────────────────────────
    const actualCost = calculateReconciliationCost({
    aiInputTokens: 0,
    aiOutputTokens: 0,
    docCountA: sideACount,
    docCountB: sideBCount,
   });
           const deduction = await deductCredits(supabase, userId, actualCost, "reconciliation", runRecord.id, {
      workspace_id,
      side_a_count: sideACount,
      side_b_count: sideBCount,
      match_count: matches.length,
      tokens_used: { input: aiInputTokens, output: aiOutputTokens, model: "gpt-4o-mini" },
    });
    
    if (!deduction.success) {
      console.warn("Queued run credit deduction failed:", deduction.error);
    }

    await supabase.from("reconciliation_workspaces").update({ status: "completed", summary, is_processing: false, processing_started_at: null }).eq("id", workspace_id);
    await supabase.from("reconciliation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runRecord.id);

    return ok({
      success: true,
      run_id: runRecord.id,
      summary,
      matches_created: matches.length,
      processed: true,
      cost: {
        estimated: estimatedCost,
        actual: actualCost,
        deducted: deduction.success,
        balance_after: deduction.success ? deduction.balance : userBalance,
      },
    });
    
  } catch (e) {
    if (workspaceLocked && workspace_id) {
      await supabase.from("reconciliation_workspaces").update({ status: "error", is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      await supabase.from("reconciliation_runs").update({ status: "failed", error_message: e.message, completed_at: new Date().toISOString() }).eq("id", runRecord.id);
    }
    if (e instanceof ReconciliationError) {
      return err(e.recoverable ? 400 : 500, e.code, e.message);
    }
    return err(500, "INTERNAL_ERROR", e.message);
  } finally {
    if (workspaceLocked && workspace_id) {
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
    }
  }
};