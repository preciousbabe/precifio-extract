// src/components/Reconcile/MatchConfigModal.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useReconciliation } from "../../hooks/useReconciliation";

const STRATEGY_OPTIONS = [
  { value: "exact_with_tolerance", label: "Exact (numeric tolerance)" },
  { value: "date_proximity", label: "Date proximity" },
  { value: "normalized_exact", label: "Normalized exact (reference)" },
  { value: "fuzzy", label: "Fuzzy text match" },
];

export default function MatchConfigModal({ workspaceId, onClose, onConfigured }) {
  const { fetchMatchConfig, saveMatchConfig, loading } = useReconciliation();
  const [config, setConfig] = useState(null);
  const [sideAFields, setSideAFields] = useState([]);
  const [sideBFields, setSideBFields] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchMatchConfig(workspaceId).then((data) => {
      if (cancelled) return;
      setConfig({
        rules: [],
        sum_matching: { enabled: false, side_a_amount_field: "", side_b_amount_field: "", tolerance_percent: 0 },
        ...data.configuration,
      });
    });
    return () => { cancelled = true; };
  }, [workspaceId]);
  

  const handleSave = async () => {
    await saveMatchConfig(workspaceId, config);
    onConfigured?.();
  };

  const updateRule = (idx, updates) => {
    setConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).map((r, i) => (i === idx ? { ...r, ...updates } : r)),
    }));
  };

  const addRule = () => {
    setConfig((prev) => ({
      ...prev,
      rules: [
        ...(prev.rules || []),
        { side_a_field: "", side_b_field: "", type: "text", weight: 0.2, strategy: "fuzzy" },
      ],
    }));
  };

  const removeRule = (idx) => {
    setConfig((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((_, i) => i !== idx),
    }));
  };

  const updateSumMatching = (updates) => {
    setConfig((prev) => ({
      ...prev,
      sum_matching: { ...prev.sum_matching, ...updates },
    }));
  };

  if (!config) return null;

  const overlay = (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999
      }}
      onClick={onClose}
    >
      <div
          style={{
          background: "white", borderRadius: "0", padding: "28px",
          width: "100%", maxWidth: "100%", height: "100vh", overflowY: "auto",
          boxShadow: "none", position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>
            Configure Matching Rules
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: "24px",
              cursor: "pointer", color: "#64748b", padding: "4px",
              lineHeight: 1
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
        
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b" }}>
          Precifio detected fields from both sides. Adjust how they should be compared.
        </p>

        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 100px 40px", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px", padding: "0 4px" }}>
            <span>Side A Field</span>
            <span>Side B Field</span>
            <span>Type</span>
            <span>Strategy</span>
            <span>Weight</span>
            <span></span>
          </div>

          {config.rules?.map((rule, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 100px 40px", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <input
                type="text"
                value={rule.side_a_field}
                onChange={(e) => updateRule(idx, { side_a_field: e.target.value })}
                placeholder="e.g. total"
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
              />
              <input
                type="text"
                value={rule.side_b_field}
                onChange={(e) => updateRule(idx, { side_b_field: e.target.value })}
                placeholder="e.g. amount"
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
              />
              <select
                value={rule.type}
                onChange={(e) => updateRule(idx, { type: e.target.value })}
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
              >
                <option value="text">Text</option>
                <option value="numeric">Numeric</option>
                <option value="date">Date</option>
                <option value="reference">Reference</option>
              </select>
              <select
                value={rule.strategy}
                onChange={(e) => updateRule(idx, { strategy: e.target.value })}
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
              >
                {STRATEGY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={rule.weight}
                onChange={(e) => updateRule(idx, { weight: parseFloat(e.target.value) })}
                style={{ padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px" }}
              />
              <button
                onClick={() => removeRule(idx)}
                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={addRule}
            style={{
              marginTop: "8px", padding: "8px 14px", borderRadius: "6px",
              border: "1px dashed #94a3b8", background: "white", color: "#64748b",
              fontSize: "13px", cursor: "pointer", width: "100%"
            }}
          >
            + Add Match Rule
          </button>
        </div>

        <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "12px" }}>
            <input
              type="checkbox"
              checked={config.sum_matching?.enabled || false}
              onChange={(e) => updateSumMatching({ enabled: e.target.checked })}
            />
            Enable Sum Matching (partial payments / combined transactions)
          </label>

          {config.sum_matching?.enabled && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Side A Amount Field</label>
                <input
                  type="text"
                  value={config.sum_matching?.side_a_amount_field || ""}
                  onChange={(e) => updateSumMatching({ side_a_amount_field: e.target.value })}
                  placeholder="e.g. total"
                  style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Side B Amount Field</label>
                <input
                  type="text"
                  value={config.sum_matching?.side_b_amount_field || ""}
                  onChange={(e) => updateSumMatching({ side_b_amount_field: e.target.value })}
                  placeholder="e.g. amount"
                  style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Tolerance %</label>
                <input
                  type="number"
                  value={config.sum_matching?.tolerance_percent || 0}
                  onChange={(e) => updateSumMatching({ tolerance_percent: parseFloat(e.target.value) })}
                  style={{ width: "100%", padding: "6px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px", borderRadius: "8px", border: "1px solid #d1d5db",
              background: "white", color: "#374151", fontSize: "14px", cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              padding: "10px 18px", borderRadius: "8px", border: "none",
              background: "#1e40af", color: "white", fontSize: "14px",
              cursor: "pointer", fontWeight: 600
            }}
          >
            {loading ? "Saving…" : "Save & Run Reconciliation"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}