// src/components/Queue/QueueViewer.jsx
// Full-screen overlay panel — renders via portal to document.body
import { getExportSettings } from "../../components/ExportSettings";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  downloadExport,
  sendToIntegration,
  connectIntegration,
  buildExportModel,
  sendEmail,
  copyToClipboard
} from "../../utils/export-utils";

import "./QueueViewer.css";

// ─── Icons ──────────────────────────────────────────────────────────

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconEyeOff = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const IconPdf = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 13h8"/>
    <path d="M8 17h5"/>
  </svg>
);

const IconDocx = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 13l2 4 2-4 2 4 2-4"/>
  </svg>
);

const IconCsv = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 13h8"/>
    <path d="M8 17h8"/>
    <path d="M12 13v4"/>
  </svg>
);

const IconJson = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 10c-1 0-2 1-2 2s1 2 2 2"/>
    <path d="M15 10c1 0 2 1 2 2s-1 2-2 2"/>
  </svg>
);

const IconOneDrive = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17h11a3 3 0 0 0 0-6 5 5 0 0 0-9-2 4 4 0 0 0-5 4 4 4 0 0 0 3 4z"/>
  </svg>
);

const IconDropbox = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="7 4 3 7 7 10 11 7 7 4"/>
    <polyline points="17 4 13 7 17 10 21 7 17 4"/>
    <polyline points="7 12 3 15 7 18 11 15 7 12"/>
    <polyline points="17 12 13 15 17 18 21 15 17 12"/>
    <path d="M12 20l-3-2 3-2 3 2-3 2z"/>
  </svg>
);

const IconGoogleDrive = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 4h10" />
    <path d="M7 4l-5 8" />
    <path d="M17 4l5 8" />
    <path d="M2 12h20" />
    <path d="M7 20l-5-8" />
    <path d="M17 20l5-8" />
    <path d="M7 20h10" />
  </svg>
);

const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
);

const IconWebhook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/>
    <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 0 1 3.89-6.06"/>
    <path d="m12.26 12.15 3.74-6.94a4 4 0 0 1 3.87-6.07"/>
    <path d="M5.57 9.3c.66.27 1.45.19 2.03-.24l2.59-1.95a3 3 0 0 1 4.17.56l1.18 1.56"/>
  </svg>
);

const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconCopy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconSlack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
    <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
    <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
    <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
    <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
    <path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/>
    <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
  </svg>
);

const IconXero = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <path d="M8 8l8 8"/>
    <path d="M16 8l-8 8"/>
  </svg>
);

const IconQuickBooks = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/>
    <path d="M7 12h10"/>
    <path d="M12 7v10"/>
  </svg>
);

const IconExcel = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 13h2"/>
    <path d="M8 17h2"/>
    <path d="M14 13h2"/>
    <path d="M14 17h2"/>
  </svg>
);

const IconTable = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
    <line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

const IconCode = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/>
    <polyline points="8 6 2 12 8 18"/>
  </svg>
);

const IconWord = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M8 12h8"/>
    <path d="M8 16h8"/>
    <path d="M8 20h8"/>
  </svg>
);


// ─── Helpers ────────────────────────────────────────────────────────

function shouldRenderAsTable(segment) {
  const fields = segment.fields || [];
  const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

  let shapeLooksTabular = false;
  if (fields.length >= 2 && isPlainObject(fields[0].value)) {
    const keys = Object.keys(fields[0].value);
    if (keys.length >= 2) {
      const sig = keys.slice().sort().join(",");
      shapeLooksTabular = fields.every((f) => {
        const v = f.value;
        return isPlainObject(v) && Object.keys(v).sort().join(",") === sig;
      });
    }
  }

  const t = (segment.segment_type || "").toLowerCase();
  if (t === "table") return shapeLooksTabular;
  if (t === "detail") return false;
  return shapeLooksTabular;
}

function getTableColumns(fields) {
  const firstVal = fields[0]?.value;
  if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal)) {
    return Object.keys(firstVal);
  }
  return ["value"];
}

function formatLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ─────────────────────────────────────────────────

function KVRow({
  label,
  value,
  confidence,
  onChange,
  onLabelChange,
  onDelete,
  dirty,
  isEditing,
}) {
  const pct = Math.round((confidence || 0) * 100);
  const confClass =
    pct < 50 ? "queue-kv-confidence very-low"
    : pct < 70 ? "queue-kv-confidence low"
    : "queue-kv-confidence";

  return (
    <div className={`queue-kv-row ${dirty ? "queue-kv-row--dirty" : ""}`}>
      <div className="queue-kv-label">
        {isEditing ? (
          <input
            className="queue-edit-label"
            value={label ?? ""}
            onChange={(e) => onLabelChange?.(e.target.value)}
          />
        ) : (
          label
        )}
      </div>
      <div className="queue-kv-value">
        {isEditing ? (
                    <input
            className="queue-edit-input"
            value={
              typeof value === "object" && value !== null
                ? Object.entries(value)
                    .map(([k, v]) => {
                      const displayV = typeof v === "object" && v !== null
                        ? JSON.stringify(v)
                        : String(v);
                      return `${formatLabel(k)}: ${displayV}`;
                    })
                    .join(", ")
                : (value ?? "")
            }
            onChange={(e) => onChange?.(e.target.value)}
          />
        ) : (
          renderValue(value)
        )}
      </div>
      <div className={confClass}>{pct}%</div>
      {isEditing && (
        <button
          className="field-delete-btn"
          onClick={onDelete}
          title="Remove field"
          type="button"
        >
          <IconTrash />
        </button>
      )}
    </div>
  );
}

function DataTable({ fields, isEditing, segmentIndex, setSegments, dirtyFields, setDirtyFields }) {
  const columns = getTableColumns(fields);
  const moneyCols = ["unit_price", "total", "subtotal", "discount", "tax", "shipping", "amount_due", "amount_paid", "balance_due", "price", "cost"];
  const numberCols = ["qty", "quantity", "amount", "count", "line_number"];

  const handleCellChange = (rowIdx, col, newValue) => {
    setSegments((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[segmentIndex].fields[rowIdx].value[col] = newValue;
      return copy;
    });
    setDirtyFields((prev) => ({
      ...prev,
      [`${segmentIndex}-${rowIdx}-${col}`]: true,
    }));
  };

  const handleDeleteRow = (rowIdx) => {
    setSegments((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[segmentIndex].fields.splice(rowIdx, 1);
      return copy;
    });
    setDirtyFields((prev) => ({
      ...prev,
      [`${segmentIndex}-row-deleted-${rowIdx}`]: true,
    }));
  };

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead className="table-head">
          <tr>
            {isEditing && <th className="table-th" style={{ width: "44px" }}></th>}
            {columns.map((col) => (
              <th key={col} className={moneyCols.includes(col) || numberCols.includes(col) ? "table-th text-center" : "table-th"}>
                {formatLabel(col)}
              </th>
            ))}
            <th className="table-th text-center">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => {
            const row = field.value || {};
            const pct = Math.round((field.confidence || 0) * 100);
            return (
              <tr key={idx} className={idx % 2 ? "table-row-alt" : ""}>
                {isEditing && (
                  <td className="table-td" style={{ width: "44px", textAlign: "center", verticalAlign: "middle" }}>
                    <button
                      className="field-delete-btn"
                      onClick={() => handleDeleteRow(idx)}
                      title="Remove row"
                      type="button"
                    >
                      <IconTrash />
                    </button>
                  </td>
                )}
                {columns.map((col) => {
                  const v = row[col];
                  const isMoney = moneyCols.includes(col);
                  const isNum = numberCols.includes(col);
                  const isDirty = dirtyFields[`${segmentIndex}-${idx}-${col}`];

                  return (
                    <td key={col} className={[
                      "table-td", 
                      isMoney || isNum ? "text-right" : "", 
                      isMoney ? "money-cell" : "",
                      isDirty ? "table-td--dirty" : ""
                    ].filter(Boolean).join(" ")}>
                      {isEditing ? (
                        <input
                          className="table-edit-input"
                          value={v ?? ""}
                          onChange={(e) => handleCellChange(idx, col, e.target.value)}
                        />
                      ) : (
                        renderValue(v)
                      )}
                    </td>
                  );
                })}
                <td className={["table-td", "table-confidence", pct >= 90 ? "good" : pct >= 70 ? "medium" : "bad"].join(" ")}>
                  {pct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderValue(value) {
  if (value === null || value === undefined) return "—";

  // Belt-and-suspenders: never render { value: "x" } as a table with "Value" label
  if (typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "value") {
      return renderValue(value.value);
    }
  }

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every((v) => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
    return (
      <ul className="nested-list">
        {value.map((v, i) => (
          <li key={i} className="nested-list-item">{renderValue(v)}</li>
        ))}
      </ul>
    );
  }

   if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "value") {
      return renderValue(value.value);
    }

    // Flatten to readable string — aligns with export format exactly
    return Object.entries(value)
      .map(([k, v]) => `${formatLabel(k)}: ${renderValue(v)}`)
      .join(" | ");
  }
  
  return String(value);
}

function ExportDropdown({ item, segments, onExport, user, disabled, config }) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(null);
  const DEFAULT_UPLOAD_FORMAT = "pdf";
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setSubmenu(null);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleExport = async (format) => {
    if (disabled) return;
    setExporting(format);
    try {
      const payload = {
        fileName: item.name,
        documentSummary: item.result?.documentSummary,
        segments,
        metadata: item.result?.metadata
      };

      switch (format) {
        case "json":
          await downloadExport({ payload, format: "json", config });
          break;
        case "excel":
          await downloadExport({ payload, format: "xlsx", config });
          break;
        case "pdf":
          await downloadExport({ payload, format: "pdf", config });
          break;
        case "docx":
          await downloadExport({ payload, format: "docx", config });
          break;

        case "xero":
        case "quickbooks":
          if (!user) {
            alert("Please sign in to use integrations.");
            setExporting(null);
            return;
          }
          await connectIntegration({
            provider: format,
            userId: user.id,
            model: buildExportModel(payload),
            exportFormat: DEFAULT_UPLOAD_FORMAT,
            options: { config }
          });
          break;

        case "webhook":
        case "slack":
          if (!user) {
            alert("Please sign in to use integrations.");
            setExporting(null);
            return;
          }
          await sendToIntegration({
            provider: format,
            payload,
            userId: user.id,
            exportFormat: DEFAULT_UPLOAD_FORMAT,
            options: { config }
          });
          break;

        case "email-pdf":
        case "email-excel":
        case "email-docx":
        case "email-json": {
          const emailFmt = format.replace("email-", "");
          const mappedFmt = emailFmt === "excel" ? "xlsx" : emailFmt;
          await sendEmail(payload, mappedFmt, config);
          break;
        }

        case "clipboard":
          await copyToClipboard(payload);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;

        default:
          console.warn("Unknown export format:", format);
          break;
      }

      if (onExport) onExport(format);
    } catch (err) {
      console.error("Export failed:", err);
      alert(err.message || "Export failed.");
    } finally {
      setExporting(null);
      setOpen(false);
      setSubmenu(null);
    }
  };

  return (
    <div className="export-wrap" ref={menuRef}>
      <button
        className={`export-trigger ${open ? "export-trigger--active" : ""} ${disabled ? "export-trigger--disabled" : ""}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={!!exporting || disabled}
        title={disabled ? "Finish editing and save changes before exporting" : ""}
      >
        <IconDownload />
        <span>
          {exporting ? "Exporting…"
            : copied ? "Copied!"
            : disabled ? "Save to Export"
            : "Export / Send"}
        </span>
        <span className="export-chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <IconChevronUp />
        </span>
      </button>

      {open && !disabled && (
        <div className="export-menu">
          <div className="export-header">Download to device</div>

          <button className="export-option" onClick={() => handleExport("json")}>
            <IconCode /> JSON (structured data)
          </button>
          <button className="export-option" onClick={() => handleExport("excel")}>
            <IconExcel /> Excel (.xlsx)
          </button>
          <button className="export-option" onClick={() => handleExport("pdf")}>
            <IconPdf /> PDF (formatted report)
          </button>
          <button className="export-option" onClick={() => handleExport("docx")}>
            <IconWord /> Word (.docx)
          </button>

          <div className="export-divider" />
          <div className="export-header">Accounting integrations</div>

          <button className="export-option" onClick={() => handleExport("xero")}>
            <IconXero /> Xero
          </button>
          <button className="export-option" onClick={() => handleExport("quickbooks")}>
            <IconQuickBooks /> QuickBooks
          </button>

          <div className="export-divider" />
          <div className="export-header">Send to system</div>

          <button className="export-option" onClick={() => handleExport("webhook")}>
            <IconWebhook /> Webhook
          </button>

          <div
            className="submenu-wrap"
            onMouseEnter={() => setSubmenu("email")}
            onMouseLeave={() => setSubmenu(null)}
          >
            <button className="export-option">
              <IconMail /> Email <span className="submenu-arrow">›</span>
            </button>
            {submenu === "email" && (
              <div className="submenu">
                <button className="export-option" onClick={() => handleExport("email-pdf")}>
                  <IconPdf /> Email as PDF
                </button>
                <button className="export-option" onClick={() => handleExport("email-excel")}>
                  <IconExcel /> Email as Excel
                </button>
                <button className="export-option" onClick={() => handleExport("email-docx")}>
                  <IconWord /> Email as Word
                </button>
                <button className="export-option" onClick={() => handleExport("email-json")}>
                  <IconCode /> Email as JSON
                </button>
              </div>
            )}
          </div>

          <button className="export-option" onClick={() => handleExport("slack")}>
            <IconSlack /> Slack / Teams
          </button>

          <div className="export-divider" />
          <div className="export-header">Copy</div>

          <button className="export-option" onClick={() => handleExport("clipboard")}>
            {copied ? <IconCheck /> : <IconCopy />}
            {copied ? "Copied to clipboard" : "Copy to clipboard"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function QueueViewer({ item, onClose, onExport, exportConfig = {} }) {
  const { user } = useAuth();
  const extraction = item?.result ?? {};
  const savedSettings = getExportSettings();
  const config = React.useMemo(() => {
    const orgName = user?.organization?.name || "";
    return {
      branding: {
        companyName: orgName || exportConfig?.branding?.companyName || savedSettings.branding.companyName || "",
        showMetadata: exportConfig?.branding?.showMetadata ?? savedSettings.branding.showMetadata,
        primaryColor: exportConfig?.branding?.primaryColor || savedSettings.branding.primaryColor || "1A365D"
      },
      includePageNumbers: exportConfig?.includePageNumbers ?? savedSettings.includePageNumbers,
      includeConfidence: exportConfig?.includeConfidence ?? savedSettings.includeConfidence
    };
  }, [exportConfig, user]);

  const [isEditing, setIsEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const metadata = extraction.metadata ?? {};
  const [segments, setSegments] = useState(() => {
    return JSON.parse(JSON.stringify(extraction.segments ?? []));
  });

  const [dirtyFields, setDirtyFields] = useState({});
  const hasChanges = Object.keys(dirtyFields).length > 0;

  // Determine which segments to display
  const displaySegments = (isEditing && showOriginal)
    ? extraction.originalSegments ?? segments
    : segments;

  useEffect(() => {
    if (!item) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  useEffect(() => {
    setSegments(JSON.parse(JSON.stringify(extraction.segments ?? [])));
    setDirtyFields({});
    setShowOriginal(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [item, onClose]);

  async function handleSaveChanges() {
    if (!user) {
      alert("Please sign in to save corrections.");
      return;
    }
      setIsSaving(true);
    try {
      const token = localStorage.getItem('precifio_token');
      if (!token) {
        alert("Session expired. Please sign in again.");
        return;
      }

      const response = await fetch("/.netlify/functions/save-pattern", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          extractionId: extraction.extractionId,
          documentFingerprint: extraction.metadata?.documentFingerprint,
          documentType: extraction.documentType,
          originalSegments: extraction.originalSegments,
          editedSegments: segments,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to save changes.");
      }

      const data = await response.json();
      alert(`Changes saved. ${data.correctionsApplied} correction rules learned.`);

      setDirtyFields({});
      setIsEditing(false);
      setShowOriginal(false);
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!item) return null;

  const overlay = (
    <div className="queue-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="queue-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="queue-header">
          <div className="queue-header-left">
            <div className="queue-header-title-wrap">
              <h2 className="queue-header-title">{item.name}</h2>
              {isEditing && (
                <div className="editing-banner">
                  ✏ Editing Mode
                </div>
              )}
            </div>
            <p className="queue-header-subtitle">{extraction.documentSummary || "No summary available"}</p>
          </div>
          <button className="queue-close-btn" onClick={onClose} title="Close">
            <IconClose />
          </button>
        </div>

        {/* Meta bar */}
        <div className="queue-meta-bar">
          <span className="queue-meta-item"><span className="queue-meta-dot" />Type: {item.type}</span>
          <span className="queue-meta-item"><span className="queue-meta-dot" />Characters: {metadata.textLength || 0}</span>
          <span className="queue-meta-item"><span className="queue-meta-dot" />🔒 Secured by Precifio AI</span>
          {item.error && <span className="queue-meta-item queue-meta-error"><span className="queue-meta-dot" style={{ background: "#ef4444" }} />Error: {item.error}</span>}
        </div>

        {/* Body */}
        <div className="queue-body">
          {item.error && !displaySegments.length && (
            <div className="error-box">
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px", marginTop: 0 }}>Processing Error</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{item.error}</p>
            </div>
          )}

          {displaySegments.length === 0 && !item.error && (
            <div className="empty-state">No extracted fields available.</div>
          )}

          {displaySegments.map((segment, index) => {
            const isTable = shouldRenderAsTable(segment);

            const handleDeleteField = (fieldIdx) => {
              setSegments((prev) => {
                const copy = JSON.parse(JSON.stringify(prev));
                copy[index].fields.splice(fieldIdx, 1);
                return copy;
              });
              setDirtyFields((prev) => ({
                ...prev,
                [`${index}-${fieldIdx}-deleted`]: true,
              }));
            };

            return (
              <div key={index} className="queue-segment">
                <h3 className="queue-segment-title">
                  {segment.segment_name}
                  {isEditing && (
                    <span className="segment-edit-hint">— {segment.fields?.length || 0} fields</span>
                  )}
                </h3>

                {isEditing && (
                  <button
                    className={`see-original-btn ${showOriginal ? "active" : ""}`}
                    onClick={() => setShowOriginal(!showOriginal)}
                    type="button"
                  >
                    {showOriginal ? <IconEyeOff /> : <IconEye />}
                    {showOriginal ? "Show Edited" : "See Original"}
                  </button>
                )}

                {isTable ? (
                  <DataTable
                    fields={segment.fields || []}
                    isEditing={isEditing}
                    segmentIndex={index}
                    setSegments={setSegments}
                    dirtyFields={dirtyFields}
                    setDirtyFields={setDirtyFields}
                  />
                ) : (
                  <div>
                    {(segment.fields || []).map((field, idx) => (
                      <KVRow
                        key={idx}
                        label={field.label}
                        value={field.value}
                        confidence={field.confidence}
                        dirty={dirtyFields[`${index}-${idx}-value`] || dirtyFields[`${index}-${idx}-label`] || dirtyFields[`${index}-${idx}-deleted`]}
                        onChange={(newValue) => {
                          setSegments((prev) => {
                            const copy = JSON.parse(JSON.stringify(prev));
                            copy[index].fields[idx].value = newValue;
                            return copy;
                          });
                          setDirtyFields((prev) => ({
                            ...prev,
                            [`${index}-${idx}-value`]: true,
                          }));
                        }}
                        onLabelChange={(newLabel) => {
                          setSegments((prev) => {
                            const copy = JSON.parse(JSON.stringify(prev));
                            copy[index].fields[idx].label = newLabel;
                            return copy;
                          });
                          setDirtyFields((prev) => ({
                            ...prev,
                            [`${index}-${idx}-label`]: true,
                          }));
                        }}
                        onDelete={() => handleDeleteField(idx)}
                        isEditing={isEditing}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Export bar */}
        <div className="export-bar">
          <div className="export-label">
            <IconDownload />
            {isEditing ? "Finish editing to export" : "Export or send this extraction"}
          </div>

          <div className="export-actions">
                        {hasChanges && (
              <button 
                className="save-review-btn" 
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            )}

            <button
              className={`edit-toggle-btn ${isEditing ? "editing" : ""}`}
              onClick={() => {
                if (isEditing && hasChanges) {
                  const confirmDiscard = window.confirm("You have unsaved changes. Discard them?");
                  if (!confirmDiscard) return;
                  setSegments(JSON.parse(JSON.stringify(extraction.segments ?? [])));
                  setDirtyFields({});
                }
                setIsEditing(!isEditing);
                setShowOriginal(false);
              }}
            >
              {isEditing ? "Cancel Editing" : "Edit Extraction"}
            </button>

            <ExportDropdown
              item={item}
              segments={segments}
              onExport={onExport}
              user={user}
              disabled={isEditing}
              config={config}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
