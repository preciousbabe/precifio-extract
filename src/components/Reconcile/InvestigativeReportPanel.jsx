// src/components/Reconcile/InvestigativeReportPanel.jsx
import React, { useState } from "react";

function SeverityBadge({ severity }) {
  const colors = {
    critical: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    high: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
    medium: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
    low: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  };
  const c = colors[severity] || colors.low;
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
      background: c.bg, color: c.text, border: `1px solid ${c.border}`, textTransform: "uppercase",
    }}>
      {severity}
    </span>
  );
}

function EvidencePath({ path }) {
  return (
    <code style={{
      fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px",
      color: "#475569", wordBreak: "break-all",
    }}>
      {path}
    </code>
  );
}

export default function InvestigativeReportPanel({ report, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");
  if (!report) return null;

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "amount", label: "Amount Analysis" },
    { key: "reference", label: "Reference" },
    { key: "date", label: "Date" },
    { key: "notes", label: `Notes (${report.investigative_notes?.length || 0})` },
  ];

  const da = report.deterministic_analysis || {};

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000,
    }} onClick={onClose}>
      <div style={{
        background: "white", borderRadius: "16px", width: "92%", maxWidth: "720px",
        maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>Investigative Report</h2>
              <span style={{
                fontSize: "12px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px",
                background: report.verdict === "matched" ? "#dcfce7" : report.verdict === "review" ? "#e0e7ff" : "#f1f5f9",
                color: report.verdict === "matched" ? "#166534" : report.verdict === "review" ? "#3730a3" : "#64748b",
              }}>
                {report.verdict}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              {report.summary_narrative}
            </p>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>
              Confidence: <strong style={{ color: "#475569" }}>{report.confidence}</strong> ·
              Type: <strong style={{ color: "#475569" }}>{report.match_type}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#64748b" }}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "0 24px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: "10px 14px", fontSize: "13px", border: "none", background: "none",
              cursor: "pointer", fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "#1e40af" : "#64748b",
              borderBottom: activeTab === tab.key ? "2px solid #1e40af" : "2px solid transparent",
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {activeTab === "overview" && (
            <div>
              <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#1e293b" }}>Scoring Breakdown</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#1e40af" }}>{report.evidence_references?.scoring_at_time?.total_score}%</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Total Score</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: "#1e40af" }}>{report.evidence_references?.scoring_at_time?.gate_score}%</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>Gate Score</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 700, color: report.evidence_references?.scoring_at_time?.all_gates_present ? "#166534" : "#dc2626" }}>
                      {report.evidence_references?.scoring_at_time?.all_gates_present ? "Yes" : "No"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>All Gates Present</div>
                  </div>
                </div>
              </div>

              {report.evidence_references?.scoring_at_time?.gate_failures?.length > 0 && (
                <div style={{ background: "#fef2f2", borderRadius: "10px", padding: "14px", marginBottom: "16px", border: "1px solid #fecaca" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#991b1b" }}>Gate Failures</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {report.evidence_references.scoring_at_time.gate_failures.map((gf, i) => (
                      <span key={i} style={{ fontSize: "12px", padding: "3px 8px", borderRadius: "4px", background: "#fee2e2", color: "#991b1b" }}>
                        {gf}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {report.evidence_references?.scoring_at_time?.warnings?.length > 0 && (
                <div style={{ background: "#fffbeb", borderRadius: "10px", padding: "14px", marginBottom: "16px", border: "1px solid #fcd34d" }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "#92400e" }}>Warnings</h4>
                  <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#92400e" }}>
                    {report.evidence_references.scoring_at_time.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "amount" && da.amount && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side A (Invoice)</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>{da.amount.side_a?.formatted || "—"}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Raw: {da.amount.side_a?.raw}</div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side B (Payment)</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>{da.amount.side_b?.formatted || "—"}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Raw: {da.amount.side_b?.raw}</div>
                </div>
              </div>

              {da.amount.difference && (
                <div style={{
                  background: da.amount.within_tolerance ? "#dcfce7" : "#fef2f2",
                  borderRadius: "10px", padding: "14px", marginBottom: "16px",
                  border: `1px solid ${da.amount.within_tolerance ? "#86efac" : "#fecaca"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: da.amount.within_tolerance ? "#166534" : "#991b1b" }}>
                      Difference: {da.amount.difference.formatted}
                    </span>
                    <SeverityBadge severity={da.amount.within_tolerance ? "low" : parseFloat(da.amount.difference.percentOfA || 0) <= 5 ? "medium" : "high"} />
                  </div>
                  {da.amount.difference.percentOfA && (
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {da.amount.difference.percentOfA}% of base amount
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>
                    Tolerance: ±{da.amount.tolerance_config?.absolute} or ±{da.amount.tolerance_config?.percent}%
                  </div>
                </div>
              )}

              <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, background: "#f8fafc", padding: "12px", borderRadius: "8px" }}>
                {da.amount.assessment}
              </div>
            </div>
          )}

          {activeTab === "reference" && da.reference && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side A Reference</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", wordBreak: "break-all" }}>{da.reference.side_a || "—"}</div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side B Reference</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b", wordBreak: "break-all" }}>{da.reference.side_b || "—"}</div>
                </div>
              </div>
              <div style={{
                background: da.reference.match_type === "exact" ? "#dcfce7" : "#fef2f2",
                borderRadius: "10px", padding: "14px",
                border: `1px solid ${da.reference.match_type === "exact" ? "#86efac" : "#fecaca"}`,
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: da.reference.match_type === "exact" ? "#166534" : "#991b1b", marginBottom: "6px" }}>
                  {da.reference.match_type === "exact" ? "✓ Exact Match" : "⚠ Mismatch Detected"}
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>{da.reference.assessment}</div>
              </div>
            </div>
          )}

          {activeTab === "date" && da.date && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side A Date</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b" }}>{da.date.parsed_a ? new Date(da.date.parsed_a).toLocaleDateString() : "Invalid"}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Raw: {da.date.side_a}</div>
                </div>
                <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Side B Date</div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#1e293b" }}>{da.date.parsed_b ? new Date(da.date.parsed_b).toLocaleDateString() : "Invalid"}</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>Raw: {da.date.side_b}</div>
                </div>
              </div>
              <div style={{
                background: da.date.within_tolerance ? "#dcfce7" : "#fef2f2",
                borderRadius: "10px", padding: "14px",
                border: `1px solid ${da.date.within_tolerance ? "#86efac" : "#fecaca"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: da.date.within_tolerance ? "#166534" : "#991b1b" }}>
                    {da.date.days_difference} days apart
                  </span>
                  <SeverityBadge severity={da.date.within_tolerance ? "low" : da.date.days_difference <= (da.date.tolerance_days * 2) ? "medium" : "high"} />
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Direction: {da.date.direction} · Tolerance: {da.date.tolerance_days} days
                </div>
                {da.date.sequence_violation && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
                    ⚠ Sequence violation: Expected {da.date.expected_sequence}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {report.investigative_notes?.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>
                  No anomalies detected. Clean match.
                </div>
              )}
              {report.investigative_notes?.map((note, i) => (
                <div key={i} style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", textTransform: "capitalize" }}>
                      {note.type.replace(/_/g, " ")}
                    </span>
                    <SeverityBadge severity={note.severity} />
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                    {note.narrative}
                  </p>
                  {note.evidence_paths?.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>EVIDENCE PATHS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {note.evidence_paths.map((ep, j) => (
                          <EvidencePath key={j} path={ep} />
                        ))}
                      </div>
                    </div>
                  )}
                  {note.suggested_actions?.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px", fontWeight: 600 }}>SUGGESTED ACTIONS</div>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#64748b" }}>
                        {note.suggested_actions.map((action, k) => (
                          <li key={k}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
