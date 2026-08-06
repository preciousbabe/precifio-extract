// src/components/Reconcile/AddToWorkspaceModal.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useReconciliation } from "../../hooks/useReconciliation";

export default function AddToWorkspaceModal({ documents, onClose, onAdded }) {
    const {
    workspaces,
    fetchWorkspaces,
    createWorkspace,
    addDocuments,
    deleteWorkspace,
    loading,
  } = useReconciliation();


  const [mode, setMode] = useState("select");
  const [newName, setNewName] = useState("");
  const [selectedWs, setSelectedWs] = useState(null);
  const [targetSide, setTargetSide] = useState("A");

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

    const handleCreateAndAdd = async () => {
    const ws = await createWorkspace({ name: newName || undefined });
    if (documents?.length > 0) {
      await addDocuments(ws.id, targetSide, documents);
    }
    onAdded?.(ws.id, targetSide);
  };


    const handleDeleteWorkspace = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this workspace? All documents and matches inside will be permanently removed.")) return;
    await deleteWorkspace(id);
    if (selectedWs === id) setSelectedWs(null);
    fetchWorkspaces();
  };

    const handleAddToExisting = async () => {
    if (!selectedWs) return;
    if (documents?.length > 0) {
      await addDocuments(selectedWs, targetSide, documents);
    }
    onAdded?.(selectedWs, targetSide);
  };

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
          background: "white", borderRadius: "16px", padding: "28px",
          width: "92%", maxWidth: "480px", boxShadow: "0 24px 48px rgba(0,0,0,0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
                      <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#1e293b" }}>
          {documents?.length > 0
            ? `Reconcile ${documents.length} document${documents.length > 1 ? "s" : ""}`
            : "Open Reconciliation Workspace"}
        </h3>
        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
          {documents?.length > 0
            ? "Choose a workspace and which side to add them to."
            : "Choose an existing workspace or create a new one. You'll upload files inside."}
        </p>

                {documents?.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              onClick={() => setTargetSide("A")}
              style={{
                flex: 1, padding: "10px", borderRadius: "8px",
                border: targetSide === "A" ? "2px solid #1e40af" : "1px solid #d1d5db",
                background: targetSide === "A" ? "#eff6ff" : "white",
                color: targetSide === "A" ? "#1e40af" : "#64748b",
                fontSize: "13px", cursor: "pointer", fontWeight: targetSide === "A" ? 600 : 400
              }}
            >
              Side A (Primary)
            </button>
            <button
              onClick={() => setTargetSide("B")}
              style={{
                flex: 1, padding: "10px", borderRadius: "8px",
                border: targetSide === "B" ? "2px solid #1e40af" : "1px solid #d1d5db",
                background: targetSide === "B" ? "#eff6ff" : "white",
                color: targetSide === "B" ? "#1e40af" : "#64748b",
                fontSize: "13px", cursor: "pointer", fontWeight: targetSide === "B" ? 600 : 400
              }}
            >
              Side B (Comparison)
            </button>
          </div>
        )}

        
        {mode === "select" && (
          <>
            <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "16px" }}>
              {workspaces.map((ws) => (
                          <div
                key={ws.id}
                onClick={() => setSelectedWs(ws.id)}
                style={{
                  padding: "12px", borderRadius: "8px", cursor: "pointer",
                  border: selectedWs === ws.id ? "2px solid #1e40af" : "1px solid #e2e8f0",
                  marginBottom: "8px", background: selectedWs === ws.id ? "#eff6ff" : "white",
                  display: "flex", alignItems: "center", justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>{ws.name}</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {ws.summary?.total || 0} docs · {ws.status}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteWorkspace(ws.id, e)}
                  style={{
                    background: "none", border: "none", color: "#ef4444",
                    fontSize: "16px", cursor: "pointer", padding: "4px 6px",
                    borderRadius: "4px", lineHeight: 1
                  }}
                  title="Delete workspace"
                >
                  ✕
                </button>
              </div>
              ))}
              {workspaces.length === 0 && (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", padding: "20px" }}>
                  No workspaces yet. Create one below.
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setMode("create")} style={{
                padding: "10px 16px", borderRadius: "8px", border: "1px solid #d1d5db",
                background: "white", color: "#374151", fontSize: "14px", cursor: "pointer"
              }}>
                + New Workspace
              </button>
                            <button
                onClick={handleAddToExisting}
                disabled={!selectedWs || loading}
                style={{
                  padding: "10px 16px", borderRadius: "8px", border: "none",
                  background: "#1e40af", color: "white", fontSize: "14px",
                  cursor: "pointer", fontWeight: 600
                }}
              >
                {loading ? "Opening…" : documents?.length > 0 ? `Add to Side ${targetSide}` : "Open Workspace"}
              </button>
            </div>
          </>
        )}

        {mode === "create" && (
          <>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
              Workspace Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. August 2026 Reconciliation"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: "8px",
                border: "1px solid #d1d5db", fontSize: "14px", marginBottom: "16px", boxSizing: "border-box"
              }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setMode("select")} style={{
                padding: "10px 16px", borderRadius: "8px", border: "1px solid #d1d5db",
                background: "white", color: "#374151", fontSize: "14px", cursor: "pointer"
              }}>
                Back
              </button>
                            <button
                onClick={handleCreateAndAdd}
                disabled={loading}
                style={{
                  padding: "10px 16px", borderRadius: "8px", border: "none",
                  background: "#1e40af", color: "white", fontSize: "14px",
                  cursor: "pointer", fontWeight: 600
                }}
              >
                {loading ? "Creating…" : documents?.length > 0 ? `Create & Add to Side ${targetSide}` : "Create Workspace"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
