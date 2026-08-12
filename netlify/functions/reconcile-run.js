// netlify/functions/reconcile-run.js
const { createClient } = require("@supabase/supabase-js");

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

function validateConfig(config) {
  if (!config || typeof config !== "object") return { valid: false, error: "configuration must be an object" };
  if (!Array.isArray(config.rules)) return { valid: false, error: "configuration.rules must be an array" };
  for (let i = 0; i < config.rules.length; i++) {
    const r = config.rules[i];
    if (!r.side_a_field || !r.side_b_field) {
      return { valid: false, error: `Rule ${i}: side_a_field and side_b_field are required` };
    }
    if (typeof r.weight !== "number" || r.weight < 0 || r.weight > 1) {
      return { valid: false, error: `Rule ${i}: weight must be between 0 and 1` };
    }
  }
  return { valid: true };
}

function parseMoney(value) {
  if (value === null || value === undefined) return null;
  let str = String(value).trim();
  if (!str) return null;

  const isNegative = str.includes("(") && str.includes(")");
  str = str.replace(/[()]/g, "");
  str = str.replace(/[$€£¥\s]/g, "");

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");

  let normalized;
  if (lastComma > lastDot && lastComma !== -1) {
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = str.replace(/,/g, "");
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  const cents = Math.round((isNegative ? -num : num) * 100);
  return {
    cents,
    original: value,
    formatted: (Math.abs(cents) / 100).toFixed(2),
    isNegative: cents < 0,
    sign: cents < 0 ? "-" : "",
  };
}

function moneyDiff(a, b) {
  if (!a || !b) return null;
  const diffCents = a.cents - b.cents;
  return {
    cents: diffCents,
    formatted: (diffCents / 100).toFixed(2),
    absCents: Math.abs(diffCents),
    absFormatted: (Math.abs(diffCents) / 100).toFixed(2),
    percentOfA: a.cents !== 0 ? ((Math.abs(diffCents) / Math.abs(a.cents)) * 100).toFixed(2) : null,
    direction: diffCents > 0 ? "a_larger" : diffCents < 0 ? "b_larger" : "equal",
  };
}

function moneyWithinTolerance(a, b, tolAbs, tolPercent) {
  if (!a || !b) return false;
  const diff = Math.abs(a.cents - b.cents);
  const absTolCents = Math.round((tolAbs || 0) * 100);
  const pctTolCents = Math.round(Math.abs(a.cents) * ((tolPercent || 0) / 100));
  return diff <= absTolCents + pctTolCents;
}

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

function parseDate(v) {
  if (!v) return null;
  const str = String(v).trim();
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}[\/\-.]\d{2}[\/\-.]\d{2}/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.floor(Math.abs(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24));
}

function dateDiffDays(a, b) {
  if (!a || !b) return null;
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function canonicalizeFieldName(raw, aliasMap) {
  const key = String(raw).toLowerCase().trim();
  return aliasMap.get(key)?.canonical || key;
}

function detectFieldType(key, aliasMap) {
  const lower = key.toLowerCase();
  if (aliasMap.has(lower)) return aliasMap.get(lower).type;
  if (/date|time|day|month|year/.test(lower)) return "date";
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

function dateSemanticScore(fieldNameA, fieldNameB) {
  const a = fieldNameA.toLowerCase();
  const b = fieldNameB.toLowerCase();
  const invoiceTerms = ["invoice", "bill", "issued", "created", "document", "generated"];
  const paymentTerms = ["payment", "paid", "settlement", "clearance", "remittance", "processed"];
  const dueTerms = ["due", "deadline", "maturity", "expiry"];

  const aIsInvoice = invoiceTerms.some(t => a.includes(t));
  const bIsInvoice = invoiceTerms.some(t => b.includes(t));
  const aIsPayment = paymentTerms.some(t => a.includes(t));
  const bIsPayment = paymentTerms.some(t => b.includes(t));
  const aIsDue = dueTerms.some(t => a.includes(t));
  const bIsDue = dueTerms.some(t => b.includes(t));

  if ((aIsInvoice && bIsPayment) || (aIsPayment && bIsInvoice)) return 1.0;
  if ((aIsDue && bIsPayment) || (aIsPayment && bIsDue)) return 0.5;
  if ((aIsInvoice || aIsDue) && (bIsInvoice || bIsDue)) return 0.3;
  return 0.1;
}

function getDateDirection(fieldNameA, fieldNameB) {
  const a = fieldNameA.toLowerCase();
  const b = fieldNameB.toLowerCase();
  const paymentTerms = ["payment", "paid", "settlement", "clearance", "remittance", "processed"];
  const invoiceTerms = ["invoice", "bill", "issued", "created", "document", "generated"];
  const dueTerms = ["due", "deadline", "maturity"];

  const aIsPayment = paymentTerms.some(t => a.includes(t));
  const bIsPayment = paymentTerms.some(t => b.includes(t));
  const aIsInvoice = invoiceTerms.some(t => a.includes(t));
  const bIsInvoice = invoiceTerms.some(t => b.includes(t));
  const aIsDue = dueTerms.some(t => a.includes(t));
  const bIsDue = dueTerms.some(t => b.includes(t));

  if (aIsInvoice && bIsPayment) return "a_before_b";
  if (aIsPayment && bIsInvoice) return "b_before_a";
  if (aIsDue && bIsPayment) return "b_before_a";
  if (aIsPayment && bIsDue) return "a_before_b";
  return null;
}

function autoGenerateMatchConfig(sideAFields, sideBFields, aliasMap, docsA = [], docsB = []) {
  const aCanon = [...new Set(sideAFields)].map(f => ({ raw: f, canon: canonicalizeFieldName(f, aliasMap) }));
  const bCanon = [...new Set(sideBFields)].map(f => ({ raw: f, canon: canonicalizeFieldName(f, aliasMap) }));

  const rules = [];
  const usedA = new Set();
  const usedB = new Set();

  if (docsA.length > 0 && docsB.length > 0) {
    const norm = v => String(v || "").toLowerCase().replace(/[^\w\s]/g, "").trim();
    const candidates = [];

    for (const af of aCanon) {
      for (const bf of bCanon) {
        const aType = detectFieldType(af.canon, aliasMap);
        const bType = detectFieldType(bf.canon, aliasMap);

        const incompatible = (aType === "numeric" && bType === "date") ||
                             (aType === "date" && bType === "numeric") ||
                             (aType === "reference" && bType === "numeric");
        if (incompatible) continue;

        const typeCompat = aType === bType ? 1 : (aType === "text" || bType === "text") ? 0.4 : 0;
        if (typeCompat === 0) continue;

        const valsA = new Set(docsA.map(d => norm(d.extracted_fields?.[af.raw])).filter(v => v.length > 1));
        const valsB = new Set(docsB.map(d => norm(d.extracted_fields?.[bf.raw])).filter(v => v.length > 1));

        let overlap = 0;
        if (valsA.size > 0 && valsB.size > 0) {
          for (const v of valsA) if (valsB.has(v)) overlap++;
          overlap /= Math.min(valsA.size, valsB.size);
        }

        const nameSim = similarity(af.canon, bf.canon);
        let semanticBoost = 0;
        if (aType === "date" && bType === "date") {
          semanticBoost = dateSemanticScore(af.raw, bf.raw) * 0.25;
        }

        const score = (overlap * 0.55) + (nameSim * 0.25) + (typeCompat * 0.10) + semanticBoost;
        if (score > 0.20) candidates.push({ af, bf, score, type: aType });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates) {
      if (usedA.has(c.af.raw) || usedB.has(c.bf.raw)) continue;
      const type = c.type;
      const isAmount = /amount|total|sum|payment|paid|due/.test(c.af.canon);
      const isCurrency = /currency/.test(c.af.canon);
      const isReference = type === "reference";
      const dateDirection = (type === "date") ? getDateDirection(c.af.raw, c.bf.raw) : null;
      const weight = isAmount ? 0.35 : type === "date" ? 0.25 : isReference ? 0.25 : isCurrency ? 0.10 : 0.15;

      rules.push({
        side_a_field: c.af.raw,
        side_b_field: c.bf.raw,
        canonical: c.af.canon,
        type,
        weight,
        is_gate: isAmount || isCurrency || isReference,
        tolerance: isAmount ? 0.01 : type === "date" ? 7 : null,
        tolerance_percent: isAmount ? 1 : null,
        strategy: isAmount ? "exact_with_tolerance" : type === "date" ? "date_proximity" : isReference ? "normalized_exact" : isCurrency ? "exact" : "fuzzy",
        date_direction: dateDirection
      });
      usedA.add(c.af.raw);
      usedB.add(c.bf.raw);
    }
  }

  for (const af of aCanon) {
    if (usedA.has(af.raw)) continue;
    const exact = bCanon.find(bf => bf.canon === af.canon && !usedB.has(bf.raw));
    if (exact) {
      const type = detectFieldType(af.canon, aliasMap);
      const isAmount = /amount|total|sum|payment|paid|due/.test(af.canon);
      const isCurrency = /currency/.test(af.canon);
      const isReference = type === "reference";
      const dateDirection = (type === "date") ? getDateDirection(af.raw, exact.raw) : null;
      const weight = isAmount ? 0.35 : type === "date" ? 0.25 : isReference ? 0.25 : isCurrency ? 0.10 : 0.15;
      rules.push({
        side_a_field: af.raw,
        side_b_field: exact.raw,
        canonical: af.canon,
        type,
        weight,
        is_gate: isAmount || isCurrency || isReference,
        tolerance: isAmount ? 0.01 : type === "date" ? 7 : null,
        tolerance_percent: isAmount ? 1 : null,
        strategy: isAmount ? "exact_with_tolerance" : type === "date" ? "date_proximity" : isReference ? "normalized_exact" : isCurrency ? "exact" : "fuzzy",
        date_direction: dateDirection
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
        is_gate: false,
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

function scorePair(docA, docB, rules) {
  let totalScore = 0;
  let totalWeight = 0;
  let gateScore = 0;
  let gateWeight = 0;
  const reasons = {};
  const gateFailures = [];
  const warnings = [];
  const fieldResults = [];
  let allGatesPresent = true;

  for (const rule of rules) {
    const valA = docA.extracted_fields?.[rule.side_a_field];
    const valB = docB.extracted_fields?.[rule.side_b_field];

    if (valA === undefined || valB === undefined) {
      if (rule.is_gate) {
        allGatesPresent = false;
        gateFailures.push(`${rule.canonical}_missing`);
      }
      fieldResults.push({ canonical: rule.canonical, match: false, score: 0, weight: rule.weight, missing: true });
      continue;
    }

    let match = false;
    let score = 0;
    let variance = null;

    switch (rule.strategy) {
      case "exact_with_tolerance": {
        const moneyA = parseMoney(valA);
        const moneyB = parseMoney(valB);
        if (moneyA && moneyB) {
          const diff = moneyDiff(moneyA, moneyB);
          const withinTol = moneyWithinTolerance(moneyA, moneyB, rule.tolerance || 0, rule.tolerance_percent || 0);
          variance = {
            diff_cents: diff.cents,
            diff_formatted: diff.formatted,
            percent_variance: diff.percentOfA,
            within_tolerance: withinTol,
          };
          if (withinTol) {
            match = true;
            score = 1;
          } else if (parseFloat(diff.percentOfA) <= 5) {
            score = 0.7;
          } else if (parseFloat(diff.percentOfA) <= 10) {
            score = 0.4;
          } else if (parseFloat(diff.percentOfA) <= 20) {
            score = 0.2;
          } else {
            score = 0;
          }
          if (!match && rule.is_gate) gateFailures.push(`${rule.canonical}_mismatch`);
        } else {
          variance = { type: "non-numeric", raw_a: valA, raw_b: valB };
          if (rule.is_gate) gateFailures.push(`${rule.canonical}_invalid`);
        }
        break;
      }

      case "date_proximity": {
        const dA = parseDate(valA), dB = parseDate(valB);
        if (dA && dB) {
          const dd = daysBetween(dA, dB);
          const tol = rule.tolerance || 7;
          variance = { days_diff: dd, tolerance: tol };
          if (dd <= tol) { match = true; score = 1; }
          else if (dd <= tol * 2) { score = 0.5; }
          else { score = 0; }
          if (rule.date_direction) {
            const delta = dateDiffDays(dA, dB);
            const isViolation = (rule.date_direction === "a_before_b" && delta < 0) || (rule.date_direction === "b_before_a" && delta > 0);
            if (isViolation) {
              warnings.push(`date_sequence_violation:${rule.canonical}`);
              match = false; score = Math.min(score, 0.5);
              variance.sequence_error = true;
              variance.expected_direction = rule.date_direction;
            }
          }
        } else {
          variance = { type: "invalid_date", raw_a: valA, raw_b: valB };
        }
        break;
      }

      case "normalized_exact": {
        const nA = normalize(valA), nB = normalize(valB);
        if (nA && nB) {
          if (nA === nB) { match = true; score = 1; }
          else if (similarity(nA, nB) >= 0.9) { score = 0.8; }
          else { score = 0; }
          if (!match && rule.is_gate) gateFailures.push(`${rule.canonical}_mismatch`);
          variance = { normalized_a: nA, normalized_b: nB, exact: nA === nB };
        } else {
          variance = { type: "empty" };
          if (rule.is_gate) gateFailures.push(`${rule.canonical}_empty`);
        }
        break;
      }

      case "exact": {
        const sA = String(valA).trim(), sB = String(valB).trim();
        if (sA.toLowerCase() === sB.toLowerCase()) { match = true; score = 1; }
        else { score = 0; }
        if (!match && rule.is_gate) gateFailures.push(`${rule.canonical}_mismatch`);
        variance = { exact: match, raw_a: sA, raw_b: sB };
        break;
      }

      case "fuzzy": {
        const sim = similarity(valA, valB);
        if (sim >= 0.9) { match = true; score = 1; }
        else if (sim >= 0.75) { score = 0.7; }
        else if (sim >= 0.6) { score = 0.4; }
        else { score = 0; }
        variance = { similarity: sim, similarity_pct: (sim * 100).toFixed(1) + "%" };
        break;
      }

      default: {
        const sim = similarity(valA, valB);
        if (sim >= 0.9) { match = true; score = 1; }
        else if (sim >= 0.7) { score = 0.6; }
        else { score = 0; }
        variance = { similarity: sim, similarity_pct: (sim * 100).toFixed(1) + "%" };
      }
    }

    totalScore += score * rule.weight;
    totalWeight += rule.weight;
    if (rule.is_gate) {
      gateScore += score * rule.weight;
      gateWeight += rule.weight;
    }
    fieldResults.push({ canonical: rule.canonical, match, score, weight: rule.weight, variance, strategy: rule.strategy });

    if (match) reasons[rule.canonical] = "exact";
    else if (score >= 0.7) reasons[rule.canonical] = "close";
    else if (score > 0) reasons[rule.canonical] = "weak";
    else reasons[rule.canonical] = "mismatch";
  }

  const normalizedScore = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
  const normalizedGateScore = gateWeight > 0 ? Math.round((gateScore / gateWeight) * 100) : 100;

  return {
    score: normalizedScore,
    gateScore: normalizedGateScore,
    reasons,
    gateFailures,
    warnings,
    fieldResults,
    totalWeight,
    allGatesPresent,
  };
}

function classifyMatch(score, gateScore, gateFailures, warnings, allGatesPresent) {
  if (gateFailures.some(g => g.includes("currency"))) {
    return { type: "currency_mismatch", status: "unmatched", confidence: "none" };
  }
  const amountFailed = gateFailures.some(g => g.includes("amount"));
  const referenceFailed = gateFailures.some(g => g.includes("reference"));
  const hasDateWarning = warnings.some(w => w.includes("date_sequence"));

  if (gateScore === 100 && allGatesPresent && !hasDateWarning && gateFailures.length === 0) {
    return { type: "exact", status: "matched", confidence: "high" };
  }
  if (score >= 90 && !amountFailed && !referenceFailed && !hasDateWarning && gateFailures.length === 0) {
    return { type: "matched", status: "matched", confidence: "high" };
  }
  if (score >= 60) {
    if (hasDateWarning && amountFailed) return { type: "amount_and_date_anomaly", status: "review", confidence: "medium" };
    if (hasDateWarning) return { type: "date_anomaly", status: "review", confidence: "medium" };
    if (amountFailed) return { type: "amount_variance", status: "review", confidence: "medium" };
    if (referenceFailed) return { type: "reference_mismatch", status: "review", confidence: "medium" };
    return { type: "review", status: "review", confidence: "medium" };
  }
  if (score >= 40 && amountFailed && !referenceFailed && !hasDateWarning) {
    return { type: "amount_variance", status: "review", confidence: "low" };
  }
  if (score >= 40) return { type: "partial", status: "partial", confidence: "low" };
  return { type: "unmatched", status: "unmatched", confidence: "none" };
}

function buildInvestigativeReport(docA, docB, scoreResult, rules, classification) {
  const report = {
    verdict: classification.status,
    confidence: classification.confidence,
    match_type: classification.type,
    deterministic_analysis: {},
    investigative_notes: [],
    evidence_references: {
      document_a: { id: docA.id, name: docA.document_name, snapshot: docA.extracted_fields },
      document_b: { id: docB.id, name: docB.document_name, snapshot: docB.extracted_fields },
      rules_applied: rules.map(r => ({
        canonical: r.canonical,
        side_a_field: r.side_a_field,
        side_b_field: r.side_b_field,
        weight: r.weight,
        strategy: r.strategy,
        is_gate: r.is_gate,
        tolerance: r.tolerance,
        tolerance_percent: r.tolerance_percent,
      })),
      scoring_at_time: {
        total_score: scoreResult.score,
        gate_score: scoreResult.gateScore,
        all_gates_present: scoreResult.allGatesPresent,
        gate_failures: scoreResult.gateFailures,
        warnings: scoreResult.warnings,
      },
    },
  };

  // Amount analysis
  const amountRule = rules.find(r => r.type === "numeric" && /amount|total|sum|payment|paid|due/.test(r.canon));
  if (amountRule) {
    const valA = docA.extracted_fields?.[amountRule.side_a_field];
    const valB = docB.extracted_fields?.[amountRule.side_b_field];
    const moneyA = parseMoney(valA);
    const moneyB = parseMoney(valB);

    if (moneyA && moneyB) {
      const diff = moneyDiff(moneyA, moneyB);
      const withinTol = moneyWithinTolerance(moneyA, moneyB, amountRule.tolerance || 0, amountRule.tolerance_percent || 0);
      report.deterministic_analysis.amount = {
        side_a: { raw: valA, cents: moneyA.cents, formatted: moneyA.formatted },
        side_b: { raw: valB, cents: moneyB.cents, formatted: moneyB.formatted },
        difference: diff,
        within_tolerance: withinTol,
        tolerance_config: { absolute: amountRule.tolerance || 0, percent: amountRule.tolerance_percent || 0 },
        assessment: diff.cents === 0 ? "Amounts match exactly." : `Difference of ${diff.absFormatted} (${diff.percentOfA || 0}% of base).`,
      };
      if (diff.cents !== 0) {
        const pct = parseFloat(diff.percentOfA || 0);
        const severity = pct <= 1 ? "low" : pct <= 5 ? "medium" : "high";
        const narrative = diff.direction === "a_larger"
          ? `The payment is ${diff.absFormatted} below the invoice amount.`
          : `The payment exceeds the invoice by ${diff.absFormatted}.`;
        report.investigative_notes.push({
          type: "amount_variance",
          severity,
          narrative: `${narrative} This could indicate a partial payment, early payment discount, credit note, or deduction.`,
          evidence_paths: [
            `document_a.extracted_fields.${amountRule.side_a_field}`,
            `document_b.extracted_fields.${amountRule.side_b_field}`,
          ],
          suggested_actions: [
            "Check payment terms for early payment discounts",
            "Review credit notes or adjustments",
            "Verify if retention or withholding applies",
            "Confirm partial payment agreement",
          ],
        });
      }
    } else {
      report.deterministic_analysis.amount = {
        side_a: { raw: valA, parsed: !!moneyA },
        side_b: { raw: valB, parsed: !!moneyB },
        assessment: "One or both amount values could not be parsed as money.",
      };
      report.investigative_notes.push({
        type: "unparseable_amount",
        severity: "high",
        narrative: "Amount field could not be parsed. Verify data extraction quality.",
        evidence_paths: [
          `document_a.extracted_fields.${amountRule.side_a_field}`,
          `document_b.extracted_fields.${amountRule.side_b_field}`,
        ],
        suggested_actions: ["Review extraction pipeline for this field", "Check for currency symbols or malformed numbers"],
      });
    }
  }

  // Reference analysis
  const refRule = rules.find(r => r.type === "reference" && r.is_gate);
  if (refRule) {
    const valA = docA.extracted_fields?.[refRule.side_a_field];
    const valB = docB.extracted_fields?.[refRule.side_b_field];
    const normA = normalize(valA);
    const normB = normalize(valB);
    report.deterministic_analysis.reference = {
      side_a: valA, side_b: valB,
      normalized_a: normA, normalized_b: normB,
      match_type: normA === normB ? "exact" : similarity(normA, normB) >= 0.9 ? "close" : "mismatch",
      assessment: normA === normB ? "Reference numbers match exactly." : `Reference mismatch: "${valA}" vs "${valB}".`,
    };
    if (normA !== normB) {
      report.investigative_notes.push({
        type: "reference_mismatch",
        severity: "high",
        narrative: `Reference numbers do not match: "${valA}" vs "${valB}". This may indicate a wrong document pairing or data entry error.`,
        evidence_paths: [
          `document_a.extracted_fields.${refRule.side_a_field}`,
          `document_b.extracted_fields.${refRule.side_b_field}`,
        ],
        suggested_actions: [
          "Verify document pairing is correct",
          "Check for typos in reference numbers",
          "Confirm if PO/invoice numbers were reissued",
        ],
      });
    }
  }

  // Date analysis
  const dateRule = rules.find(r => r.type === "date");
  if (dateRule) {
    const valA = docA.extracted_fields?.[dateRule.side_a_field];
    const valB = docB.extracted_fields?.[dateRule.side_b_field];
    const dA = parseDate(valA);
    const dB = parseDate(valB);
    if (dA && dB) {
      const dd = daysBetween(dA, dB);
      const delta = dateDiffDays(dA, dB);
      const tol = dateRule.tolerance || 7;
      report.deterministic_analysis.date = {
        side_a: valA, side_b: valB,
        parsed_a: dA.toISOString(), parsed_b: dB.toISOString(),
        days_difference: dd,
        direction: delta > 0 ? "b_after_a" : delta < 0 ? "a_after_b" : "same_day",
        within_tolerance: dd <= tol,
        tolerance_days: tol,
        sequence_violation: dateRule.date_direction
          ? (dateRule.date_direction === "a_before_b" && delta < 0) || (dateRule.date_direction === "b_before_a" && delta > 0)
          : false,
        expected_sequence: dateRule.date_direction || null,
      };
      if (dd > tol) {
        report.investigative_notes.push({
          type: "date_variance",
          severity: dd <= tol * 2 ? "low" : "medium",
          narrative: `Dates differ by ${dd} days (tolerance: ${tol}). ${delta > 0 ? "Side B is later." : delta < 0 ? "Side A is later." : ""}`,
          evidence_paths: [
            `document_a.extracted_fields.${dateRule.side_a_field}`,
            `document_b.extracted_fields.${dateRule.side_b_field}`,
          ],
          suggested_actions: ["Verify payment processing delays", "Check for backdated or post-dated entries"],
        });
      }
      if (report.deterministic_analysis.date.sequence_violation) {
        report.investigative_notes.push({
          type: "date_sequence_violation",
          severity: "high",
          narrative: `Date sequence violation detected. Expected: ${dateRule.date_direction}, but dates are out of order.`,
          evidence_paths: [
            `document_a.extracted_fields.${dateRule.side_a_field}`,
            `document_b.extracted_fields.${dateRule.side_b_field}`,
          ],
          suggested_actions: ["Verify document dates are correct", "Check for data entry errors in date fields"],
        });
      }
    } else {
      report.deterministic_analysis.date = {
        side_a: valA, side_b: valB,
        parsed_a: !!dA, parsed_b: !!dB,
        assessment: "One or both dates could not be parsed.",
      };
    }
  }

  // Currency analysis
  const currencyRule = rules.find(r => r.canon.includes("currency"));
  if (currencyRule) {
    const valA = docA.extracted_fields?.[currencyRule.side_a_field];
    const valB = docB.extracted_fields?.[currencyRule.side_b_field];
    const match = normalize(valA) === normalize(valB);
    report.deterministic_analysis.currency = {
      side_a: valA, side_b: valB,
      match,
      assessment: match ? "Currencies match." : `Currency mismatch: ${valA} vs ${valB}.`,
    };
    if (!match) {
      report.investigative_notes.push({
        type: "currency_mismatch",
        severity: "critical",
        narrative: `Currency mismatch detected: ${valA} vs ${valB}. This is a hard stop — amounts cannot be reconciled across currencies without conversion rates.`,
        evidence_paths: [
          `document_a.extracted_fields.${currencyRule.side_a_field}`,
          `document_b.extracted_fields.${currencyRule.side_b_field}`,
        ],
        suggested_actions: [
          "Apply exchange rate conversion before reconciliation",
          "Verify if multi-currency transaction is intentional",
          "Check if one side is reporting in functional currency",
        ],
      });
    }
  }

  // Summary narrative
  const noteCount = report.investigative_notes.length;
  if (noteCount === 0) {
    report.summary_narrative = "All fields align within configured tolerances. This is a clean match.";
  } else {
    const severities = report.investigative_notes.map(n => n.severity);
    const maxSeverity = severities.includes("critical") ? "critical" : severities.includes("high") ? "high" : severities.includes("medium") ? "medium" : "low";
    report.summary_narrative = `Match requires review. ${noteCount} anomaly${noteCount > 1 ? "ies" : "y"} detected with maximum severity: ${maxSeverity}.`;
  }

  return report;
}

function findSubsetSum(items, target, tolAbs, amountField, rules, targetDoc, targetSide = "B", strictRef = false) {
  const referenceRule = rules.find(r => r.type === "reference" && r.is_gate);
  const vendorRule = rules.find(r => (r.canon.includes("vendor") || r.canon.includes("supplier") || r.canon.includes("payee")) && r.weight >= 0.1);

  const targetRef = referenceRule ? normalize(targetDoc.extracted_fields?.[targetSide === "A" ? referenceRule.side_a_field : referenceRule.side_b_field]) : null;
  const targetVen = vendorRule ? normalize(targetDoc.extracted_fields?.[targetSide === "A" ? vendorRule.side_a_field : vendorRule.side_b_field]) : null;

  log("debug", "subset_sum_start", { target, tolerance: tolAbs, amountField, strictRef, targetVen, targetRef, poolSize: items.length });

  const valid = items.map(it => ({
    it,
    amt: (parseMoney(it.extracted_fields?.[amountField]) || { cents: 0 }).cents / 100,
    ref: referenceRule ? normalize(it.extracted_fields?.[targetSide === "A" ? referenceRule.side_b_field : referenceRule.side_a_field]) : null,
    ven: vendorRule ? normalize(it.extracted_fields?.[targetSide === "A" ? vendorRule.side_b_field : vendorRule.side_a_field]) : null,
  })).filter(x => {
    if (x.amt <= 0) return false;
    if (targetVen && x.ven) {
      const sim = similarity(targetVen, x.ven);
      if (sim < 0.8) {
        log("debug", "subset_sum_vendor_filtered", { doc: x.it.document_name, ven: x.ven, sim });
        return false;
      }
    }
    if (strictRef && targetRef && x.ref && x.ref !== targetRef) {
      log("debug", "subset_sum_ref_filtered", { doc: x.it.document_name, ref: x.ref });
      return false;
    }
    return true;
  }).sort((a, b) => b.amt - a.amt);

  log("debug", "subset_sum_valid_pool", { count: valid.length });

  const greedy = [];
  let remaining = target;
  for (const x of valid) {
    if (remaining <= tolAbs) break;
    if (x.amt <= remaining + tolAbs) {
      greedy.push(x.it);
      remaining -= x.amt;
    }
  }
  if (greedy.length > 1 && Math.abs(remaining) <= tolAbs) {
    log("debug", "subset_sum_greedy_match", { picked: greedy.length, remaining });
    return greedy;
  }

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const sum = valid[i].amt + valid[j].amt;
      if (Math.abs(target - sum) <= tolAbs) {
        log("debug", "subset_sum_pair_match", { i: valid[i].it.document_name, j: valid[j].it.document_name, sum });
        return [valid[i].it, valid[j].it];
      }
    }
  }

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      for (let k = j + 1; k < valid.length; k++) {
        const sum = valid[i].amt + valid[j].amt + valid[k].amt;
        if (Math.abs(target - sum) <= tolAbs) {
          log("debug", "subset_sum_triple_match");
          return [valid[i].it, valid[j].it, valid[k].it];
        }
      }
    }
  }

  log("debug", "subset_sum_no_match");
  return null;
}

function findMatches(docsA, docsB, rules, sumConfig) {
  const docAMatched = new Set();
  const docBMatched = new Set();
  const matches = [];
  const rejectedCandidates = [];
  const permanentlyRejected = new Set();

  // Phase 1: Confident 1:1 matches
  for (const a of docsA) {
    if (docAMatched.has(a.id)) continue;
    let best = null, bestScore = 0, bestResult = null;
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const result = scorePair(a, b, rules);
      if (result.score > bestScore) {
        bestScore = result.score;
        best = b;
        bestResult = result;
      }
    }
    if (best && bestScore >= 90) {
      const classification = classifyMatch(bestScore, bestResult.gateScore, bestResult.gateFailures, bestResult.warnings, bestResult.allGatesPresent);
      if (classification.status === "matched") {
        const report = buildInvestigativeReport(a, best, bestResult, rules, classification);
        matches.push({
          docA_id: a.id, docB_id: best.id,
          type: classification.type, status: classification.status, score: bestScore,
          reasons: bestResult.reasons,
          gate_failures: bestResult.gateFailures,
          warnings: bestResult.warnings,
          field_results: bestResult.fieldResults,
          investigative_report: report,
        });
        docAMatched.add(a.id);
        docBMatched.add(best.id);
      }
    }
  }

  // Phase 2: 1:N Sum matching
  if (sumConfig?.enabled && sumConfig.side_a_amount_field && sumConfig.side_b_amount_field) {
    log("debug", "phase_2_sum_matching_start", { aField: sumConfig.side_a_amount_field, bField: sumConfig.side_b_amount_field });
    for (const a of docsA) {
      if (docAMatched.has(a.id)) continue;
      const targetMoney = parseMoney(a.extracted_fields?.[sumConfig.side_a_amount_field]);
      const target = targetMoney ? targetMoney.cents / 100 : 0;
      if (!target) continue;
      const pool = docsB.filter(b => !docBMatched.has(b.id));
      const tolPct = (sumConfig.tolerance_percent || 0) / 100;
      const tolAbs = target * tolPct + 0.01;
      log("debug", "phase_2_attempt", { doc: a.document_name, target, poolSize: pool.length });
      const subset = findSubsetSum(pool, target, tolAbs, sumConfig.side_b_amount_field, rules, a, "A", false);
      if (subset) {
        log("debug", "phase_2_match", { doc: a.document_name, subsetCount: subset.length });
        for (const b of subset) {
          matches.push({
            docA_id: a.id, docB_id: b.id,
            type: "partial_sum", status: "review", score: 85,
            reasons: { amount_sum: true, item_count: subset.length },
            gate_failures: [], warnings: [],
            investigative_report: {
              verdict: "review", confidence: "medium", match_type: "partial_sum",
              summary_narrative: `Invoice of ${targetMoney.formatted} matched against ${subset.length} partial payments totaling approximately the same amount.`,
              deterministic_analysis: {
                amount: {
                  side_a: { raw: a.extracted_fields?.[sumConfig.side_a_amount_field], formatted: targetMoney.formatted },
                  side_b: { item_count: subset.length, note: "Multiple payments combined" },
                },
              },
              investigative_notes: [{
                type: "partial_payment", severity: "medium",
                narrative: `This invoice appears to have been paid in ${subset.length} installments. Verify all payment references align.`,
                suggested_actions: ["Cross-check each payment reference", "Verify no duplicate payments included"],
              }],
            },
          });
          docBMatched.add(b.id);
        }
        docAMatched.add(a.id);
      }
    }
  }

  // Phase 3: N:1 Sum matching
  if (sumConfig?.enabled && sumConfig.side_a_amount_field && sumConfig.side_b_amount_field) {
    log("debug", "phase_3_sum_matching_start");
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const targetMoney = parseMoney(b.extracted_fields?.[sumConfig.side_b_amount_field]);
      const target = targetMoney ? targetMoney.cents / 100 : 0;
      if (!target) continue;
      const pool = docsA.filter(a => !docAMatched.has(a.id));
      const tolPct = (sumConfig.tolerance_percent || 0) / 100;
      const tolAbs = target * tolPct + 0.01;
      log("debug", "phase_3_attempt", { doc: b.document_name, target, poolSize: pool.length });
      const subset = findSubsetSum(pool, target, tolAbs, sumConfig.side_a_amount_field, rules, b, "B", false);
      if (subset) {
        log("debug", "phase_3_match", { doc: b.document_name, subsetCount: subset.length });
        for (const a of subset) {
          matches.push({
            docA_id: a.id, docB_id: b.id,
            type: "split", status: "review", score: 80,
            reasons: { amount_split: true, item_count: subset.length },
            gate_failures: [], warnings: [],
            investigative_report: {
              verdict: "review", confidence: "medium", match_type: "split",
              summary_narrative: `Payment of ${targetMoney.formatted} appears to cover ${subset.length} invoices.`,
              deterministic_analysis: {
                amount: {
                  side_a: { item_count: subset.length, note: "Multiple invoices combined" },
                  side_b: { raw: b.extracted_fields?.[sumConfig.side_b_amount_field], formatted: targetMoney.formatted },
                },
              },
              investigative_notes: [{
                type: "consolidated_payment", severity: "medium",
                narrative: `This payment covers multiple invoices. Ensure each invoice is correctly allocated.`,
                suggested_actions: ["Verify invoice allocation matches payment", "Check for unallocated balances"],
              }],
            },
          });
          docAMatched.add(a.id);
        }
        docBMatched.add(b.id);
      }
    }
  }

  // Phase 4: Fuzzy / Review candidates
  for (const a of docsA) {
    if (docAMatched.has(a.id)) continue;
    let best = null, bestScore = 0, bestResult = null;
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const pairKey = `${a.id}-${b.id}`;
      if (permanentlyRejected.has(pairKey)) continue;
      const result = scorePair(a, b, rules);
      if (result.score > bestScore) {
        bestScore = result.score;
        best = b;
        bestResult = result;
      }
    }
    if (best && bestScore >= 60) {
      const classification = classifyMatch(bestScore, bestResult.gateScore, bestResult.gateFailures, bestResult.warnings, bestResult.allGatesPresent);
      if (classification.status !== "unmatched") {
        const report = buildInvestigativeReport(a, best, bestResult, rules, classification);
        matches.push({
          docA_id: a.id, docB_id: best.id,
          type: classification.type, status: classification.status, score: bestScore,
          reasons: bestResult.reasons,
          gate_failures: bestResult.gateFailures,
          warnings: bestResult.warnings,
          field_results: bestResult.fieldResults,
          investigative_report: report,
        });
        docAMatched.add(a.id);
        docBMatched.add(best.id);
      } else {
        permanentlyRejected.add(`${a.id}-${best.id}`);
        rejectedCandidates.push({
          doc_id: a.id, doc_side: "A",
          candidate_id: best.id, candidate_side: "B",
          score: bestScore, reason: classification.type,
          gate_failures: bestResult.gateFailures,
          warnings: bestResult.warnings,
        });
      }
    }
  }

  // Phase 5: Near-miss surfacing
  for (const a of docsA) {
    if (docAMatched.has(a.id)) continue;
    const candidates = [];
    for (const b of docsB) {
      if (docBMatched.has(b.id)) continue;
      const pairKey = `${a.id}-${b.id}`;
      if (permanentlyRejected.has(pairKey)) continue;
      const result = scorePair(a, b, rules);
      candidates.push({ b, score: result.score, result });
    }
    candidates.sort((x, y) => y.score - x.score);
    for (const cand of candidates) {
      if (cand.score < 40) break;
      const classification = classifyMatch(cand.score, cand.result.gateScore, cand.result.gateFailures, cand.result.warnings, cand.result.allGatesPresent);
      if (classification.status !== "unmatched") {
        const report = buildInvestigativeReport(a, cand.b, cand.result, rules, classification);
        matches.push({
          docA_id: a.id, docB_id: cand.b.id,
          type: classification.type, status: classification.status, score: cand.score,
          reasons: cand.result.reasons,
          gate_failures: cand.result.gateFailures,
          warnings: cand.result.warnings,
          field_results: cand.result.fieldResults,
          investigative_report: report,
        });
        docAMatched.add(a.id);
        docBMatched.add(cand.b.id);
        break;
      } else {
        permanentlyRejected.add(`${a.id}-${cand.b.id}`);
        rejectedCandidates.push({
          doc_id: a.id, doc_side: "A",
          candidate_id: cand.b.id, candidate_side: "B",
          score: cand.score, reason: classification.type,
          gate_failures: cand.result.gateFailures,
          warnings: cand.result.warnings,
        });
      }
    }
  }

  // Capture rejected candidates for unmatched B docs
  for (const b of docsB) {
    if (docBMatched.has(b.id)) continue;
    let best = null, bestScore = 0, bestResult = null;
    for (const a of docsA) {
      if (docAMatched.has(a.id)) continue;
      const pairKey = `${a.id}-${b.id}`;
      if (permanentlyRejected.has(pairKey)) continue;
      const result = scorePair(a, b, rules);
      if (result.score > bestScore) {
        bestScore = result.score;
        best = a;
        bestResult = result;
      }
    }
    if (best) {
      rejectedCandidates.push({
        doc_id: b.id, doc_side: "B",
        candidate_id: best.id, candidate_side: "A",
        score: bestScore,
        reason: bestScore >= 40 ? classifyMatch(bestScore, bestResult.gateScore, bestResult.gateFailures, bestResult.warnings, bestResult.allGatesPresent).type : "score_too_low",
        gate_failures: bestResult.gateFailures,
        warnings: bestResult.warnings,
      });
    }
  }

  return { matches, docAMatched, docBMatched, rejectedCandidates };
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

    // Record run start
    const { data: runRecord } = await supabase
      .from("reconciliation_runs")
      .insert({
        workspace_id,
        user_id: userId,
        idempotency_key: idempotencyKey || null,
        status: "running",
      })
      .select()
      .single();

    // Clear old matches and reset statuses
    await supabase.from("reconciliation_matches").delete().eq("workspace_id", workspace_id);
    await supabase
      .from("reconciliation_documents")
      .update({ status: "unmatched", match_score: null })
      .eq("workspace_id", workspace_id);

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
      return { ...doc, document_name: name, extracted_fields: fields };
    };
    const normalizedSideA = (sideA || []).map(normalizeDoc);
    const normalizedSideB = (sideB || []).map(normalizeDoc);

    if (!sideA?.length || !sideB?.length) {
      await supabase.from("reconciliation_workspaces").update({ status: "completed", is_processing: false, processing_started_at: null }).eq("id", workspace_id);
      await supabase.from("reconciliation_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runRecord.id);
      return ok({ message: "Both sides need data to reconcile", summary: ws.summary });
    }

    // Get or generate config
    let config = ws.match_configuration;
    if (!config || !config.rules || config.auto_generated) {
      const aliasMap = await resolveFieldAliases(userId);
      const aFields = [...new Set(normalizedSideA.flatMap(d => Object.keys(d.extracted_fields || {})))];
      const bFields = [...new Set(normalizedSideB.flatMap(d => Object.keys(d.extracted_fields || {})))];
      config = autoGenerateMatchConfig(aFields, bFields, aliasMap, normalizedSideA, normalizedSideB);

      const configValid = validateConfig(config);
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

    const { matches, docAMatched, docBMatched, rejectedCandidates } = findMatches(
      normalizedSideA,
      normalizedSideB,
      config.rules || [],
      config.sum_matching || {}
    );

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

    await supabase.from("reconciliation_workspaces").update({ status: "completed", summary, is_processing: false, processing_started_at: null }).eq("id", workspace_id);
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