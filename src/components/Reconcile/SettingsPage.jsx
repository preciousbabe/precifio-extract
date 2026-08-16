// src/components/Reconcile/SettingsPage.jsx
import React, { useState, useEffect } from "react";
import { useReconciliation } from "../../hooks/useReconciliation";

export default function SettingsPage() {
  const {
    fetchConsent,
    grantConsent,
    fetchFieldAliases,
    saveFieldAlias,
    deleteFieldAlias,
    deleteAllData,
    loading,
    error,
  } = useReconciliation();

  const [consent, setConsent] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [showAliasForm, setShowAliasForm] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [canonicalName, setCanonicalName] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [aliasInput, setAliasInput] = useState("");

  const [showNuclear, setShowNuclear] = useState(false);
  const [nuclearText, setNuclearText] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const c = await fetchConsent();
      setConsent(c.settings);
      const a = await fetchFieldAliases();
      setAliases(a.aliases || []);
    } catch {
      // hook surfaces error via `error` state
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm("Revoke consent? This disables reconciliation until you re-enable it.")) return;
    await grantConsent(false);
    setConsent((prev) => ({ ...prev, consent_granted: false, consent_granted_at: null }));
  };

  const handleReEnable = async () => {
    await grantConsent(true);
    const c = await fetchConsent();
    setConsent(c.settings);
  };

  const resetAliasForm = () => {
    setEditingId(null);
    setCanonicalName("");
    setFieldType("text");
    setAliasInput("");
    setShowAliasForm(false);
  };

  const handleSaveAlias = async () => {
    const name = canonicalName.trim().toLowerCase();
    const rawAliases = aliasInput
      .split(/[,|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!name || rawAliases.length === 0) return;

    await saveFieldAlias({
      canonical_name: name,
      aliases: rawAliases,
      field_type: fieldType,
    });
    resetAliasForm();
    const a = await fetchFieldAliases();
    setAliases(a.aliases || []);
  };

  const handleEditAlias = (al) => {
    setEditingId(al.id);
    setCanonicalName(al.canonical_name);
    setFieldType(al.field_type || "text");
    setAliasInput(al.aliases.join(", "));
    setShowAliasForm(true);
  };

  const handleDeleteAlias = async (id) => {
    if (!window.confirm("Delete this alias?")) return;
    await deleteFieldAlias(id);
    setAliases((prev) => prev.filter((a) => a.id !== id));
  };

  const handleExport = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      consent: consent,
      field_aliases: aliases,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `precifio-reconciliation-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNuclearDelete = async () => {
    if (nuclearText !== "DELETE") return;
    if (!window.confirm("This is irreversible. All workspaces, documents, matches, and aliases will be permanently removed.")) return;
    try {
      await deleteAllData();
      setAliases([]);
      setConsent(null);
      setShowNuclear(false);
      setNuclearText("");
      alert("All reconciliation data has been deleted.");
    } catch (e) {
      alert("Delete failed: " + (e.message || "Unknown error"));
    }
  };

  const granted = !!consent?.consent_granted;
  const grantedDate = consent?.consent_granted_at
    ? new Date(consent.consent_granted_at).toLocaleString()
    : null;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "22px", color: "#1e293b", margin: "0 0 24px" }}>Reconciliation Settings</h1>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", color: "#dc2626", borderRadius: "8px", fontSize: "13px", marginBottom: "20px" }}>
          {error}
        </div>
      )}

      {/* ── Consent ── */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>Consent & Privacy</h2>
          <span style={{
            fontSize: "12px", fontWeight: 600, padding: "4px 10px", borderRadius: "999px",
            background: granted ? "#dcfce7" : "#f1f5f9",
            color: granted ? "#166534" : "#64748b",
          }}>
            {granted ? "Enabled" : "Disabled"}
          </span>
        </div>

        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
          {granted
            ? `You enabled reconciliation on ${grantedDate}. Structured extracted data is stored for matching. Original files are never kept.`
            : "Reconciliation is currently disabled. Enable it to match documents across datasets."}
        </p>

        <div style={{ marginBottom: "16px" }}>
          <a
            href="/reconcile-guide.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "13px", color: "#1e40af", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            📖 How Reconciliation Works — Full Guide
            <span style={{ fontSize: "16px" }}>↗</span>
          </a>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {granted ? (
            <button
              onClick={handleRevoke}
              disabled={loading}
              style={{
                padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db",
                background: "white", color: "#374151", fontSize: "13px", cursor: "pointer"
              }}
            >
              Revoke Consent
            </button>
          ) : (
            <button
              onClick={handleReEnable}
              disabled={loading}
              style={{
                padding: "8px 14px", borderRadius: "6px", border: "none",
                background: "#1e40af", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600
              }}
            >
              Enable Reconciliation
            </button>
          )}
        </div>
      </div>

      {/* ── Field Aliases ── */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", color: "#1e293b", margin: 0 }}>Field Aliases</h2>
          <button
            onClick={() => setShowAliasForm((s) => !s)}
            style={{
              padding: "6px 12px", borderRadius: "6px", border: "1px solid #1e40af",
              background: "white", color: "#1e40af", fontSize: "12px", cursor: "pointer", fontWeight: 600
            }}
          >
            {showAliasForm ? "Cancel" : "+ Add Alias"}
          </button>
        </div>

        {showAliasForm && (
          <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Canonical Name</label>
                <input
                  type="text"
                  value={canonicalName}
                  onChange={(e) => setCanonicalName(e.target.value)}
                  placeholder="e.g. amount"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Field Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                >
                  <option value="text">Text</option>
                  <option value="numeric">Numeric</option>
                  <option value="date">Date</option>
                  <option value="reference">Reference</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "4px" }}>Aliases (comma-separated)</label>
                <input
                  type="text"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="e.g. amt, total, grand_total"
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #d1d5db", fontSize: "13px", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={resetAliasForm} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db", background: "white", fontSize: "13px", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={handleSaveAlias}
                disabled={loading || !canonicalName.trim() || !aliasInput.trim()}
                style={{
                  padding: "8px 14px", borderRadius: "6px", border: "none",
                  background: "#1e40af", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600
                }}
              >
                {loading ? "Saving…" : editingId ? "Update Alias" : "Save Alias"}
              </button>
            </div>
          </div>
        )}

        {aliases.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px" }}>
            No aliases yet. Add one to improve auto-matching accuracy.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {aliases.map((al) => (
              <div key={al.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "8px", border: "1px solid #f1f5f9", background: "#fafafa" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>
                    {al.canonical_name}
                    <span style={{ marginLeft: "8px", fontSize: "11px", color: "#64748b", fontWeight: 400, textTransform: "capitalize" }}>({al.field_type})</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {al.aliases.join(", ")}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleEditAlias(al)}
                    style={{ background: "none", border: "none", color: "#1e40af", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAlias(al.id)}
                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", cursor: "pointer" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Data Management ── */}
      <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
        <h2 style={{ fontSize: "16px", color: "#1e293b", margin: "0 0 12px" }}>Data Management</h2>
        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px", lineHeight: 1.5 }}>
          Export your aliases and settings, or permanently erase every reconciliation record.
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleExport}
            style={{
              padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db",
              background: "white", color: "#374151", fontSize: "13px", cursor: "pointer"
            }}
          >
            📥 Export Data (JSON)
          </button>

          {!showNuclear ? (
            <button
              onClick={() => setShowNuclear(true)}
              style={{
                padding: "8px 14px", borderRadius: "6px", border: "1px solid #fca5a5",
                background: "#fef2f2", color: "#dc2626", fontSize: "13px", cursor: "pointer"
              }}
            >
              ⚠ Delete All Data
            </button>
          ) : (
            <div style={{ width: "100%", marginTop: "8px", padding: "14px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
              <p style={{ fontSize: "13px", color: "#7f1d1d", margin: "0 0 10px", fontWeight: 600 }}>
                Type DELETE to confirm permanent deletion of all workspaces, documents, matches, aliases, and settings.
              </p>
              <input
                type="text"
                value={nuclearText}
                onChange={(e) => setNuclearText(e.target.value)}
                placeholder="DELETE"
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #fca5a5", fontSize: "13px", marginBottom: "10px", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => { setShowNuclear(false); setNuclearText(""); }} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db", background: "white", fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={handleNuclearDelete}
                  disabled={nuclearText !== "DELETE" || loading}
                  style={{
                    padding: "8px 14px", borderRadius: "6px", border: "none",
                    background: "#dc2626", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600
                  }}
                >
                  {loading ? "Deleting…" : "Permanently Delete Everything"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}