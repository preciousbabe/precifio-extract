// src/components/Reconcile/ReconcileWorkspaceModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useReconciliation } from "../../hooks/useReconciliation";
import MatchConfigModal from "./MatchConfigModal";
import SettingsPage from "./SettingsPage";

async function parseSpreadsheet(file) {
  const name = file.name.toLowerCase();
  
  if (name.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [data];
  }
  
  if (name.endsWith('.csv')) {
    return new Promise((resolve, reject) => {
      import("papaparse").then(({ default: Papa }) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (r) => resolve(r.data), error: reject });
      });
    });
  }
  
  // XLSX
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).toLowerCase().trim().replace(/\s+/g, "_"));
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}


function normalizeCSVRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase().trim().replace(/\s+/g, "_");
    out[key] = v;
  }
  return out;
}

function UploadToSideModal({ side, onClose, onUploadCSV }) {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (files.length > 0) {
      setIsUploading(true);
      await onUploadCSV(files);
      setIsUploading(false);
      onClose();
    }
  };

  const overlay = (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: "12px", padding: "24px",
          width: "92%", maxWidth: "440px", boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", color: "#1e293b" }}>
          Add to Side {side}
        </h3>
        <input
          type="file"
          accept=".csv,.xlsx,.json"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files))}
          style={{ marginBottom: "12px" }}
        />
        <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "16px" }}>
          Upload CSV, Excel (.xlsx), or JSON. Each row/object represents a document on Side {side}. 200 documents max.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db", background: "white", fontSize: "13px", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || isUploading}
            style={{
              padding: "8px 14px", borderRadius: "6px", border: "none",
              background: "#1e40af", color: "white", fontSize: "13px", cursor: "pointer"
            }}
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}


export default function ReconcileWorkspaceModal({ workspaceId, onClose }) {
  const {
    currentWorkspace,
    results,
    fetchResults,
    addDocuments,
    runReconciliation,
    removeDocument,
    loading,
    error,
  } = useReconciliation();

  const [activeTab, setActiveTab] = useState("side_a");
  const [showConfig, setShowConfig] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [uploadSide, setUploadSide] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGearMenu, setShowGearMenu] = useState(false);
  const gearRef = useRef(null);


  useEffect(() => {
    if (workspaceId) fetchResults(workspaceId);
  }, [workspaceId, fetchResults]);


    useEffect(() => {
    function handleClick(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setShowGearMenu(false);
      }
    }
    if (showGearMenu) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showGearMenu]);

    const handleCSVUpload = async (files, side) => {
  try {
    let allRows = [];
    for (const file of files) {
      const rows = await parseSpreadsheet(file);
      if (Array.isArray(rows) && rows.length > 0) {
        allRows = allRows.concat(rows);
      }
    }
    if (allRows.length === 0) {
      alert("Files appear empty or could not be parsed.");
      return;
    }
    const docs = allRows.map((r, i) => ({
      document_name: `Row ${i + 1}`,
      extracted_fields: normalizeCSVRow(r),
      source_type: files[0]?.name?.toLowerCase()?.endsWith('.json') ? "api" : "csv_row",
    }));
    await addDocuments(workspaceId, side, docs);
    await fetchResults(workspaceId);
  } catch (err) {
    console.error("Upload error:", err);
    alert("Failed to parse file: " + (err.message || "Unknown error"));
  }
};


     const handleDownloadResults = async () => {
    if (!currentWorkspace) return;

    // Strip every internal ID before generating PDF
    const stripIds = (obj) => {
      if (!obj || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(stripIds);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (["id", "workspace_id", "user_id", "document_id", "document_b_id", "matched_document_ids", "matched_transaction_ids"].includes(k)) continue;
        out[k] = stripIds(v);
      }
      return out;
    };

    const cleanDocs = stripIds(results?.documents || []);
    const cleanMatches = stripIds(results?.matches || []);
    const wsName = currentWorkspace.name || "Reconciliation";

    const [{ jsPDF }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable")
    ]);

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(wsName, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Matched: ${s.matched || 0} · Partial: ${s.partial || 0} · Review: ${s.review || 0} · Unmatched: ${s.unmatched || 0}`, 14, 34);

    let startY = 42;

    // Side A table
    const sideA = cleanDocs.filter((d) => d.dataset_side === "A");
    if (sideA.length) {
      doc.setFontSize(13);
      doc.text("Side A Documents", 14, startY);
      doc.autoTable({
        startY: startY + 4,
        head: [["Name", "Status", "Score", "Fields"]],
        body: sideA.map((d) => [
          d.document_name,
          d.status,
          d.match_score ? `${d.match_score}%` : "—",
          JSON.stringify(d.extracted_fields ?? {}).slice(0, 90),
        ]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] },
      });
      startY = doc.lastAutoTable.finalY + 10;
    }

    // Side B table
    const sideB = cleanDocs.filter((d) => d.dataset_side === "B");
    if (sideB.length) {
      doc.setFontSize(13);
      doc.text("Side B Documents", 14, startY);
      doc.autoTable({
        startY: startY + 4,
        head: [["Name", "Status", "Score", "Fields"]],
        body: sideB.map((d) => [
          d.document_name,
          d.status,
          d.match_score ? `${d.match_score}%` : "—",
          JSON.stringify(d.extracted_fields ?? {}).slice(0, 90),
        ]),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] },
      });
      startY = doc.lastAutoTable.finalY + 10;
    }

    // Matches table
    if (cleanMatches.length) {
      doc.setFontSize(13);
      doc.text("Match Results", 14, startY);
      doc.autoTable({
        startY: startY + 4,
        head: [["Side A", "Side B", "Type", "Score", "Status"]],
        body: cleanMatches.map((m) => {
          const docA = sideA.find((d) => d.document_name === (m.document_a_snapshot?.document_name || m.document_name)) || {};
          const docB = sideB.find((d) => d.document_name === (m.document_b_snapshot?.document_name || m.document_name)) || {};
          return [
            docA.document_name || "—",
            docB.document_name || "—",
            m.match_type,
            `${m.match_score}%`,
            m.status,
          ];
        }),
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175] },
      });
    }

    doc.save(`reconciliation-${wsName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await runReconciliation(workspaceId);
      await fetchResults(workspaceId);
      setActiveTab("matched");
    } finally {
      setIsRunning(false);
    }
  };

  const s = currentWorkspace?.summary || {};
  const sideADocs = React.useMemo(() => (results?.documents || []).filter((d) => d.dataset_side === "A"), [results?.documents]);
  const sideBDocs = React.useMemo(() => (results?.documents || []).filter((d) => d.dataset_side === "B"), [results?.documents]);


    const renderDocList = (docs, sideLabel) => (
  <div style={{ maxHeight: "300px", overflowY: "auto" }}>
    {docs.map((doc) => {
      const fields = doc.extracted_fields || {};
      const preview = Object.entries(fields).slice(0, 3).map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`).join(" | ");
      const isDeleting = deletingDocId === doc.id;
      return (
        <div key={doc.id} style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", opacity: isDeleting ? 0.5 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>{doc.document_name}</div>
            <div style={{ color: "#64748b", fontSize: "12px" }}>{preview}</div>
            {doc.status !== "unmatched" && (
              <span style={{
                fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                background: doc.status === "matched" ? "#dcfce7" : doc.status === "review" ? "#e0e7ff" : "#fef3c7",
                color: doc.status === "matched" ? "#166534" : doc.status === "review" ? "#3730a3" : "#92400e",
                marginTop: "4px", display: "inline-block"
              }}>
                {doc.status} {doc.match_score ? `(${doc.match_score}%)` : ""}
              </span>
            )}
          </div>
          <button
            onClick={async () => {
              if (!window.confirm(`Remove "${doc.document_name}" from ${sideLabel}?`)) return;
              setDeletingDocId(doc.id);
              try {
                await removeDocument(doc.id);
                await fetchResults(workspaceId);
              } finally {
                setDeletingDocId(null);
              }
            }}
            disabled={isDeleting}
            style={{
              background: "none", border: "none", color: isDeleting ? "#cbd5e1" : "#94a3b8",
              fontSize: "16px", cursor: isDeleting ? "not-allowed" : "pointer", padding: "4px",
              flexShrink: 0
            }}
            title="Remove document"
          >
            {isDeleting ? "…" : "✕"}
          </button>
        </div>
      );
    })}
    {docs.length === 0 && (
      <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>
        No documents on this side yet.
      </div>
    )}
  </div>
);

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
          background: "white", borderRadius: "16px", width: "92%", maxWidth: "1000px",
          maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>
              {currentWorkspace?.name || "Reconciliation Workspace"}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
              {sideADocs.length} docs on Side A · {sideBDocs.length} docs on Side B
              {s.total > 0 && ` · ${s.matched || 0} matched`}
            </p>
          </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={handleDownloadResults}
              disabled={!results?.documents?.length}
              title="Download results"
              style={{
                background: "white", border: "1px solid #d1d5db",
                borderRadius: "6px", padding: "6px 12px",
                fontSize: "13px", cursor: "pointer", color: "#374151"
              }}
            >
              📥 Download
            </button>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ position: "relative" }} ref={gearRef}>
              <button
                onClick={() => setShowGearMenu(!showGearMenu)}
                style={{
                  background: "white", border: "1px solid #d1d5db",
                  borderRadius: "6px", padding: "6px 10px",
                  fontSize: "13px", cursor: "pointer", color: "#374151"
                }}
                title="Settings"
              >
                ⚙ Settings
              </button>
              {showGearMenu && (
                <div style={{
                  position: "absolute", right: 0, top: "110%",
                  background: "white", border: "1px solid #e2e8f0",
                  borderRadius: "8px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  minWidth: "200px", zIndex: 1000, padding: "6px 0"
                }}>
                  <button
                    onClick={() => { setShowGearMenu(false); setShowSettings(true); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 14px", border: "none", background: "none",
                      fontSize: "13px", cursor: "pointer", color: "#374151"
                    }}
                  >
                    ⚙ Reconciliation Settings
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#64748b" }}>
              ✕
            </button>
          </div>
          </div>
        </div>

        <div style={{ padding: "12px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setUploadSide("A")}
            style={{
              padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db",
              background: "white", color: "#374151", fontSize: "13px", cursor: "pointer"
            }}
          >
            + Add to Side A
          </button>
          <button
            onClick={() => setUploadSide("B")}
            style={{
              padding: "8px 14px", borderRadius: "6px", border: "1px solid #d1d5db",
              background: "white", color: "#374151", fontSize: "13px", cursor: "pointer"
            }}
          >
            + Add to Side B
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowConfig(true)}
            disabled={sideADocs.length === 0 || sideBDocs.length === 0}
            style={{
              padding: "8px 14px", borderRadius: "6px", border: "1px solid #1e40af",
              background: "white", color: "#1e40af", fontSize: "13px", cursor: "pointer"
            }}
          >
            ⚙ Match Rules
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning || sideADocs.length === 0 || sideBDocs.length === 0}
            style={{
              padding: "8px 16px", borderRadius: "6px", border: "none",
              background: "#1e40af", color: "white", fontSize: "13px", cursor: "pointer", fontWeight: 600
            }}
          >
            {isRunning ? "Running…" : "▶ Run Reconciliation"}
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 24px", background: "#fef2f2", color: "#dc2626", fontSize: "13px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "4px", padding: "0 24px", borderBottom: "1px solid #e2e8f0" }}>
          {["side_a", "side_b", "matched", "partial", "review", "unmatched"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 14px", fontSize: "13px", border: "none", background: "none",
                cursor: "pointer", fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "#1e40af" : "#64748b",
                borderBottom: activeTab === tab ? "2px solid #1e40af" : "2px solid transparent"
              }}
            >
              {tab === "side_a" ? `Side A (${sideADocs.length})`
                : tab === "side_b" ? `Side B (${sideBDocs.length})`
                : tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
          {activeTab === "side_a" && renderDocList(sideADocs, "Side A")}
          {activeTab === "side_b" && renderDocList(sideBDocs, "Side B")}

                  <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
          {activeTab === "side_a" && renderDocList(sideADocs, "Side A")}
          {activeTab === "side_b" && renderDocList(sideBDocs, "Side B")}

          {activeTab === "unmatched" && (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Document</th>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Side</th>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(results?.documents || [])
                    .filter((d) => d.status === "unmatched")
                    .map((d) => (
                      <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px" }}>{d.document_name || "—"}</td>
                        <td style={{ padding: "8px" }}>{d.dataset_side}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "#f1f5f9", color: "#64748b" }}>
                            unmatched
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {(results?.documents || []).filter((d) => d.status === "unmatched").length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>
                  No unmatched documents.
                </div>
              )}
            </div>
          )}

          {["matched", "partial", "review"].includes(activeTab) && (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Side A Document</th>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Side B Document</th>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "8px", color: "#64748b", fontWeight: 600 }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(results?.matches || [])
                    .filter((m) => m.status === activeTab)
                    .map((m) => {
                      const docA = sideADocs.find((d) => d.id === m.document_id);
                      const docB = sideBDocs.find((d) => d.id === m.document_b_id);
                      return (
                        <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px" }}>{docA?.document_name || "—"}</td>
                          <td style={{ padding: "8px" }}>{docB?.document_name || "—"}</td>
                          <td style={{ padding: "8px" }}>
                            <span style={{
                              fontSize: "11px", padding: "2px 8px", borderRadius: "4px",
                              background: m.match_type === "exact" ? "#dcfce7" : m.match_type === "partial_sum" ? "#fef3c7" : "#e0e7ff",
                              color: m.match_type === "exact" ? "#166534" : m.match_type === "partial_sum" ? "#92400e" : "#3730a3"
                            }}>
                              {m.match_type}
                            </span>
                          </td>
                          <td style={{ padding: "8px", fontWeight: 600 }}>{m.match_score}%</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {(results?.matches || []).filter((m) => m.status === activeTab).length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8", fontSize: "13px" }}>
                  No {activeTab} results. Try checking another tab.
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {uploadSide && (
   <UploadToSideModal
    side={uploadSide}
    onClose={() => setUploadSide(null)}
    onUploadCSV={(files) => handleCSVUpload(files, uploadSide)}
  />
  )}

      {showConfig && (
        <MatchConfigModal
          workspaceId={workspaceId}
          onClose={() => setShowConfig(false)}
          onConfigured={() => {
            setShowConfig(false);
            handleRun();
          }}
        />
      )}


            {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "white", zIndex: 100001, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>Reconciliation Settings</h2>
            <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#64748b" }}>
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <SettingsPage />
          </div>
        </div>
      )}

    </div>
  );

  return createPortal(overlay, document.body);
}
