// src/components/Queue/ExportAllButton.jsx
import React, { useState, useRef, useEffect } from "react";
import { downloadExport } from "../../utils/export-utils";
import { useAuth } from "../../hooks/useAuth";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import ReconcileConsentModal from "../Reconcile/ReconcileConsentModal";
import AddToWorkspaceModal from "../Reconcile/AddToWorkspaceModal";
import ReconcileWorkspaceModal from "../Reconcile/ReconcileWorkspaceModal";

const EXPORT_FORMATS = [
  { key: "pdf", label: "PDF" },
  { key: "docx", label: "Word (.docx)" },
  { key: "xlsx", label: "Excel (.xlsx)" },
  { key: "json", label: "JSON" },
  { key: "reconcile", label: "🔄 Reconcile" },
];

function extractReconcileFields(result) {
  if (!result?.segments) return {};
  const fields = {};
  result.segments.forEach((seg) => {
    (seg.fields || []).forEach((f) => {
      const key = String(f.label).toLowerCase().replace(/\s+/g, "_");
      fields[key] = f.value;
    });
  });
  if (result.metadata) Object.assign(fields, result.metadata);
  return fields;
}

export default function ExportAllButton({ items, config = {} }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef(null);
  const { isGuest } = useAuth();
  const [showConsent, setShowConsent] = useState(false);
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const successfulItems = items.filter(
    (item) => item.result && !item.error && item.result.segments?.length > 0
  );

  const docsForReconcile = successfulItems.map((item) => ({
    document_name: item.name,
    extracted_fields: extractReconcileFields(item.result),
  }));

  const handleConsentGranted = () => {
    setShowConsent(false);
    setShowWorkspacePicker(true);
  };

  const handleDocumentsAdded = (workspaceId) => {
    setShowWorkspacePicker(false);
    setActiveWorkspaceId(workspaceId);
    setShowWorkspace(true);
  };

  const handleExportAll = async (format) => {
    setExporting(true);
    setOpen(false);

   if (format === "reconcile") {
  if (isGuest) {
    window.dispatchEvent(
      new CustomEvent("showAuthModal", { detail: { mode: "signup" } })
    );
    setExporting(false);
    return;
  }
  setShowConsent(true);
  setExporting(false);
  return;
}

    if (successfulItems.length === 0) {
      alert("No successfully extracted documents to export.");
      setExporting(false);
      return;
    }

    if (successfulItems.length === 1) {
      const item = successfulItems[0];
      const payload = {
        fileName: item.name,
        documentSummary: item.result?.documentSummary,
        segments: item.result?.segments,
        metadata: item.result?.metadata,
      };

      try {
        await downloadExport({ payload, format, config });
      } catch (err) {
        console.error("Export failed:", err);
        alert("Export failed: " + err.message);
      }
      setExporting(false);
      return;
    }

    // Multiple files — create ZIP
    const zip = new JSZip();
    const folderName = config?.branding?.companyName
      ? `${config.branding.companyName}-extractions`
      : "extractions";
    const folder = zip.folder(folderName);

    for (const item of successfulItems) {
      const payload = {
        fileName: item.name,
        documentSummary: item.result?.documentSummary,
        segments: item.result?.segments,
        metadata: item.result?.metadata,
      };

      try {
        const result = await downloadExport({ payload, format, config, returnBuffer: true });
        const ext = format === "excel" ? "xlsx" : format;
        const fileName = `${item.name.replace(/\.[^/.]+$/, "")}.${ext}`;
        folder.file(fileName, result.buffer, { binary: true });
      } catch (err) {
        console.error(`Failed to export ${item.name}:`, err);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipName = config?.branding?.companyName
      ? `${config.branding.companyName}-extractions-${new Date().toISOString().slice(0, 10)}.zip`
      : `extractions-${new Date().toISOString().slice(0, 10)}.zip`;

    saveAs(zipBlob, zipName);

    setExporting(false);
  };

  if (successfulItems.length === 0) return null;

  return (
    <div className="export-all-wrap" ref={menuRef}>
      <button
        className={`export-all-btn ${exporting ? "exporting" : ""}`}
        onClick={() => setOpen(!open)}
        disabled={exporting}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>{exporting ? "Exporting…" : `Export All (${successfulItems.length})`}</span>
      </button>

      {open && (
        <div className="export-all-menu">
          <div className="export-all-header">
            Export {successfulItems.length} document{successfulItems.length > 1 ? "s" : ""}
          </div>
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.key}
              className="export-all-option"
              onClick={() => handleExportAll(fmt.key)}
              disabled={exporting}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      )}

      {showConsent && (
        <ReconcileConsentModal
          onClose={() => setShowConsent(false)}
          onGranted={handleConsentGranted}
        />
      )}
      {showWorkspacePicker && (
        <AddToWorkspaceModal
          documents={docsForReconcile}
          onClose={() => setShowWorkspacePicker(false)}
          onAdded={handleDocumentsAdded}
        />
      )}
      {showWorkspace && activeWorkspaceId && (
        <ReconcileWorkspaceModal
          workspaceId={activeWorkspaceId}
          onClose={() => setShowWorkspace(false)}
        />
      )}
    </div>
  );
}
