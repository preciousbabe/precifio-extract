// netlify/functions/reconcile-run.js
const { createClient } = require("@supabase/supabase-js");
const { calculateReconciliationCost, getUserCredits, deductCredits } = require("./lib/credits");
const core = require("./lib/reconcile-core");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const IS_PROD = process.env.NODE_ENV === "production";

function log(level, event, meta = {}) {
  if (IS_PROD && level === "debug") return;
  const entry = { level, event, timestamp: new Date().toISOString(), ...meta };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

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

function validateUUID(v, name) {
  if (!v || typeof v !== "string") return { valid: false, error: `${name} is required` };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
    return { valid: false, error: `${name} must be a valid UUID` };
  return { valid: true };
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

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      return err(400, "INVALID_JSON", "Invalid JSON body");
    }

    workspace_id = body.workspace_id;
    const uuidCheck = validateUUID(workspace_id, "workspace_id");
    if (!uuidCheck.valid) return err(400, "VALIDATION_ERROR", uuidCheck.error);

    const { data: ws } = await supabase
      .from("reconciliation_workspaces")
      .select("*")
      .eq("id", workspace_id)
      .eq("user_id", userId)
      .single();
    if (!ws) return err(404, "NOT_FOUND", "Workspace not found");

    // ─── RATE LIMITING: max 1 run per workspace per 10 seconds ───
    const { data: recentRun } = await supabase
      .from("reconciliation_runs")
      .select("created_at")
      .eq("workspace_id", workspace_id)
      .in("status", ["running", "queued", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentRun) {
      const secondsSince = (Date.now() - new Date(recentRun.created_at).getTime()) / 1000;
      if (secondsSince < 10) {
        return err(429, "RATE_LIMITED", "Maximum 1 run per 10 seconds. Please wait.");
      }
    }

    // Idempotency: check for recent run
    const idempotencyKey = body.idempotency_key;
    if (idempotencyKey) {
      const { data: existingRun } = await supabase
        .from("reconciliation_runs")
        .select("id, status, created_at")
        .eq("workspace_id", workspace_id)
        .eq("idempotency_key", idempotencyKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingRun) {
        const ageMinutes = (Date.now() - new Date(existingRun.created_at).getTime()) / 60000;
        if (ageMinutes < 30) {
          log("info", "idempotent_return", { runId: existingRun.id, ageMinutes });
          return ok({ success: true, idempotent: true, run_id: existingRun.id });
        }
      }
    }

    // Lock workspace using dedicated is_processing flag with timeout recovery
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
      log("warn", "workspace_lock_failed", { workspace_id, error: lockErr?.message });
      return err(409, "ALREADY_PROCESSING", "Workspace is already processing or lock could not be acquired");
    }
       workspaceLocked = true;

    // Fetch both sides first (needed for credit check)
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

    // Normalize nested extracted_fields
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
      const allText = Object.values(fields).filter(v => typeof v === "string" && v.length > 3).join(" ");
      const extractedRefs = core.extractEmbeddedReferences(allText);
      if (extractedRefs.length > 0) {
        fields.__extracted_refs = extractedRefs;
      }
      return { ...doc, document_name: name, extracted_fields: fields };
    };
    const normalizedSideA = (sideA || []).map(normalizeDoc);
    const normalizedSideB = (sideB || []).map(normalizeDoc);

    // ─── CREDIT CHECK (fail fast before mutating anything) ───────────────
    const sideACount = normalizedSideA.length;
    const sideBCount = normalizedSideB.length;
    const estimatedCost = calculateReconciliationCost(sideACount, sideBCount, 0);
    const userBalance = await getUserCredits(supabase, userId);

    if (userBalance < estimatedCost) {
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      workspaceLocked = false;
      return err(402, "PAYMENT_REQUIRED", `Insufficient credits. This run requires ~${estimatedCost} credits. Your balance: ${userBalance}.`, { required: estimatedCost, balance: userBalance });
    }

    // ─── BACKGROUND QUEUE: >500 documents per side ───
    if (normalizedSideA.length > 500 || normalizedSideB.length > 500) {
      await supabase.from("reconciliation_runs").update({ status: "queued", estimated_cost: estimatedCost }).eq("id", runRecord.id);
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      workspaceLocked = false;
      return ok({ queued: true, message: "Large dataset queued for background processing", run_id: runRecord.id, cost: { estimated: estimatedCost } });
    }

    // Record run start (now that we know they can afford it)
    const { data: runRecord, error: runErr } = await supabase
      .from("reconciliation_runs")
      .insert({
        workspace_id,
        user_id: userId,
        idempotency_key: idempotencyKey || null,
        status: "running",
        estimated_cost: estimatedCost,
      })
      .select()
      .single();
    if (runErr) throw runErr;

    // Clear old matches and reset statuses
    await supabase.from("reconciliation_matches").delete().eq("workspace_id", workspace_id);
    await supabase
      .from("reconciliation_documents")
      .update({ status: "unmatched", match_score: null })
      .eq("workspace_id", workspace_id);


    // ─── BACKGROUND QUEUE: >500 documents per side ───
    if (normalizedSideA.length > 500 || normalizedSideB.length > 500) {
      await supabase.from("reconciliation_runs").update({ status: "queued" }).eq("id", runRecord.id);
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      workspaceLocked = false;
      return ok({ queued: true, message: "Large dataset queued for background processing", run_id: runRecord.id });
    }

        if (!sideA?.length || !sideB?.length) {
      await supabase.from("reconciliation_workspaces").update({ 
        status: "completed", 
        summary: ws.summary, 
        is_processing: false, 
        processing_started_at: null,
        last_rejected_candidates: null
      }).eq("id", workspace_id);
      await supabase.from("reconciliation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runRecord.id);
      return ok({ message: "Both sides need data to reconcile", summary: ws.summary });
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
        log("error", "auto_config_invalid", { error: configValid.error });
        throw new ReconciliationError("CONFIG_ERROR", configValid.error);
      }

      await supabase.from("reconciliation_workspaces").update({ match_configuration: config }).eq("id", workspace_id);
    }

    log("info", "reconcile_start", {
      workspace_id,
      run_id: runRecord.id,
      sideACount: normalizedSideA.length,
      sideBCount: normalizedSideB.length,
      ruleCount: config.rules.length,
      sumMatching: config.sum_matching?.enabled,
    });

      const { matches, docAMatched, docBMatched, rejectedCandidates, unmatchedReports } = core.findMatches(
      normalizedSideA,
      normalizedSideB,
      config.rules || [],
      config.sum_matching || {},
      log
    );

    // ─── OPTIONAL: OpenAI narrative enhancement ───
    const openaiKey = process.env.OPENAI_API_KEY;
    const shouldGenerateNarrative = body.generate_narrative !== false;
    if (openaiKey && shouldGenerateNarrative) {
      for (const m of matches) {
        if (m.investigative_report) {
          m.investigative_report = await core.enhanceReportWithOpenAI(m.investigative_report, openaiKey);
        }
      }
    }

    log("info", "reconcile_complete", {
      workspace_id,
      run_id: runRecord.id,
      matches: matches.length,
      unmatchedA: normalizedSideA.filter(d => !docAMatched.has(d.id)).length,
      unmatchedB: normalizedSideB.filter(d => !docBMatched.has(d.id)).length,
    });

    // Write matches with snapshots and investigative reports
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
      if (insErr) {
        log("error", "match_insert_failed", { error: insErr.message });
        throw new ReconciliationError("INSERT_ERROR", "Failed to save match results: " + insErr.message);
      }
    }

    // Update document statuses (bulk)
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
      const { error: upErr } = await supabase
        .from("reconciliation_documents")
        .update({ status: group.status, match_score: group.score })
        .in("id", group.ids);
      if (upErr) {
        log("error", "bulk_doc_update_failed", { error: upErr.message });
        throw new ReconciliationError("UPDATE_ERROR", "Failed to update document statuses: " + upErr.message);
      }
    }

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
    const actualCost = calculateReconciliationCost(sideACount, sideBCount, matches.length);
    const deduction = await deductCredits(supabase, userId, actualCost, "reconciliation", runRecord.id, {
      workspace_id,
      side_a_count: sideACount,
      side_b_count: sideBCount,
      match_count: matches.length,
    });

    if (!deduction.success) {
      log("warn", "credit_deduction_failed", { workspace_id, error: deduction.error });
    }

    await supabase.from("reconciliation_workspaces").update({ status: "completed", summary, is_processing: false, processing_started_at: null, last_rejected_candidates: rejectedCandidates.length > 0 ? rejectedCandidates : null }).eq("id", workspace_id);
    await supabase.from("reconciliation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runRecord.id);

    return ok({
      success: true,
      run_id: runRecord.id,
      summary,
      matches_created: matches.length,
      configuration: config,
      rejected_candidates: rejectedCandidates.map(rc => ({
        document_id: rc.doc_id,
        document_side: rc.doc_side,
        best_candidate_id: rc.candidate_id,
        best_candidate_side: rc.candidate_side,
        score: rc.score,
        reason: rc.reason,
        gate_failures: rc.gate_failures,
        warnings: rc.warnings,
      })),
      cost: {
        estimated: estimatedCost,
        actual: actualCost,
        deducted: deduction.success,
        balance_after: deduction.success ? deduction.balance : userBalance,
      },
    });

  } catch (e) {
    log("error", "reconcile_run_error", {
      workspace_id,
      error: e.message,
      code: e.code || "UNKNOWN",
      stack: IS_PROD ? undefined : e.stack,
    });

    if (workspaceLocked && workspace_id) {
      await supabase.from("reconciliation_workspaces").update({ status: "error", is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      await supabase.from("reconciliation_runs").update({ status: "failed", error_message: e.message, completed_at: new Date().toISOString() }).eq("workspace_id", workspace_id).eq("status", "running");
    }

    if (e instanceof ReconciliationError) {
      return err(e.recoverable ? 400 : 500, e.code, e.message);
    }
    return err(500, "INTERNAL_ERROR", e.message || "Internal error during reconciliation");
  } finally {
    if (workspaceLocked && workspace_id) {
      await supabase.from("reconciliation_workspaces").update({ is_processing: false, processing_started_at: null }).eq("id", workspace_id);
    }
  }
};