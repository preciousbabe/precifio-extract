// src/components/Queue/QueueViewer.jsx
// Full-screen overlay panel — renders via portal to document.body

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
  const firstVal = fields[0].value;
  if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal)) {
    return Object.keys(firstVal);
  }
  return ["value"];
}

function formatLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ─────────────────────────────────────────────────

function KVRow({ label, value, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const confClass =
    pct < 50 ? "queue-kv-confidence very-low"
    : pct < 70 ? "queue-kv-confidence low"
    : "queue-kv-confidence";

  return (
    <div className="queue-kv-row">
      <div className="queue-kv-label">{label}</div>
      <div className="queue-kv-value">{renderValue(value)}</div>
      <div className={confClass}>{pct}%</div>
    </div>
  );
}

function DataTable({ fields }) {
  const columns = getTableColumns(fields);
  const moneyCols = [
    "unit_price", "total", "subtotal", "discount", "tax", "shipping",
    "amount_due", "amount_paid", "balance_due", "price", "cost",
  ];
  const numberCols = ["qty", "quantity", "amount", "count", "line_number"];

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead className="table-head">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className={moneyCols.includes(col) || numberCols.includes(col) ? "table-th text-center" : "table-th"}
              >
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
                {columns.map((col) => {
                  const v = row[col];
                  const isMoney = moneyCols.includes(col);
                  const isNum = numberCols.includes(col);
                  return (
                    <td
                      key={col}
                      className={["table-td", isMoney || isNum ? "text-right" : "", isMoney ? "money-cell" : ""].filter(Boolean).join(" ")}
                    >
                      {renderValue(v)}
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
  if (typeof value === "string" || typeof value === "number") return String(value);
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
    return (
      <table className="nested-table">
        <tbody>
          {Object.entries(value).map(([k, v]) => (
            <tr key={k}>
              <th className="nested-th">{formatLabel(k)}</th>
              <td className="nested-td">{renderValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return String(value);
}


function ExportDropdown({ item, segments, onExport, user }) {
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
        await downloadExport({ payload, format: "json" });
        break;
      case "csv":
        await downloadExport({ payload, format: "csv" });
        break;
      case "excel":
        await downloadExport({ payload, format: "xlsx" });
        break;
      case "pdf":
        await downloadExport({ payload, format: "pdf" });
        break;
      case "docx":
        await downloadExport({ payload, format: "docx" });
        break;

      case "xero-pdf":
      case "xero-docx":
      case "xero-json":
      case "xero-csv":
      case "xero-xlsx":
      case "quickbooks-pdf":
      case "quickbooks-docx":
      case "quickbooks-json":
      case "quickbooks-csv":
      case "quickbooks-xlsx":
      case "google-drive-pdf":
      case "google-drive-docx":
      case "google-drive-json":
      case "google-drive-csv":
      case "google-drive-xlsx":
      case "dropbox-pdf":
      case "dropbox-docx":
      case "dropbox-json":
      case "dropbox-csv":
      case "dropbox-xlsx":
      case "onedrive-pdf":
      case "onedrive-docx":
      case "onedrive-json":
      case "onedrive-csv":
      case "onedrive-xlsx":
      case "webhook":
      case "slack":
        if (!user) {
          alert("Please sign in to use integrations.");
          setExporting(null);
          return;
        }

        // ─── FIXED PARSING ─────────────────────────────
        // Don't use format.split("-") — it breaks on "google-drive-pdf"
        const oauthProviders = ["google-drive", "dropbox", "onedrive", "xero", "quickbooks"];
        
        let cloudProvider = format;
        let exportFormat = DEFAULT_UPLOAD_FORMAT;

        // Find the longest matching provider prefix
        for (const p of oauthProviders.sort((a, b) => b.length - a.length)) {
          if (format === p) {
            cloudProvider = p;
            exportFormat = DEFAULT_UPLOAD_FORMAT;
            break;
          }
          if (format.startsWith(p + "-")) {
            cloudProvider = p;
            exportFormat = format.slice(p.length + 1); // everything after "provider-"
            break;
          }
        }

        // For non-OAuth providers (webhook, slack), format IS the provider
        if (!oauthProviders.includes(cloudProvider)) {
          cloudProvider = format;
          exportFormat = DEFAULT_UPLOAD_FORMAT;
        }
        // ──────────────────────────────────────────────

        if (oauthProviders.includes(cloudProvider)) {
          await connectIntegration({
            provider: cloudProvider,
            userId: user.id,
            model: buildExportModel(payload),
            exportFormat,
            options: {}
          });
        } else {
          await sendToIntegration({
            provider: cloudProvider,
            payload,
            userId: user.id,
            exportFormat
          });
        }
        break;

      case "email":
        await sendEmail(payload);
        break;

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

  const EXPORT_FORMATS = [
    { key: "pdf", label: "PDF", icon: <IconPdf /> },
    { key: "docx", label: "Word (.docx)", icon: <IconWord /> },
    { key: "excel", label: "Excel (.xlsx)", icon: <IconExcel /> },
    { key: "csv", label: "CSV", icon: <IconTable /> },
    { key: "json", label: "JSON", icon: <IconCode /> },
  ];

  return (
    <div className="export-wrap" ref={menuRef}>
      <button
        className={`export-trigger ${open ? "export-trigger--active" : ""}`}
        onClick={() => setOpen(!open)}
        disabled={!!exporting}
      >
        <IconDownload />
        <span>{exporting ? "Exporting…" : copied ? "Copied!" : "Export / Send"}</span>
        <span className="export-chevron" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <IconChevronUp />
        </span>
      </button>

      {open && (
        <div className="export-menu">
          <div className="export-header">Download to device</div>

          <button className="export-option" onClick={() => handleExport("json")}>
            <IconCode /> JSON (structured data)
          </button>
          <button className="export-option" onClick={() => handleExport("csv")}>
            <IconTable /> CSV (spreadsheet)
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
          <div className="export-header">Cloud integrations</div>

          <div
            className="submenu-wrap"
            onMouseEnter={() => setSubmenu("google-drive")}
            onMouseLeave={() => setSubmenu(null)}
          >
            <button className="export-option">
              <IconGoogleDrive /> Google Drive <span className="submenu-arrow">›</span>
            </button>
            {submenu === "google-drive" && (
              <div className="submenu">
                {EXPORT_FORMATS.map(f => (
                  <button key={f.key} className="export-option" onClick={() => handleExport(`google-drive-${f.key}`)}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="submenu-wrap"
            onMouseEnter={() => setSubmenu("dropbox")}
            onMouseLeave={() => setSubmenu(null)}
          >
            <button className="export-option">
              <IconDropbox /> Dropbox <span className="submenu-arrow">›</span>
            </button>
            {submenu === "dropbox" && (
              <div className="submenu">
                {EXPORT_FORMATS.map(f => (
                  <button key={f.key} className="export-option" onClick={() => handleExport(`dropbox-${f.key}`)}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div
            className="submenu-wrap"
            onMouseEnter={() => setSubmenu("onedrive")}
            onMouseLeave={() => setSubmenu(null)}
          >
            <button className="export-option">
              <IconOneDrive /> OneDrive <span className="submenu-arrow">›</span>
            </button>
            {submenu === "onedrive" && (
              <div className="submenu">
                {EXPORT_FORMATS.map(f => (
                  <button key={f.key} className="export-option" onClick={() => handleExport(`onedrive-${f.key}`)}>
                    {f.icon} {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="export-divider" />
          <div className="export-header">Send to system</div>

          <button className="export-option" onClick={() => handleExport("webhook")}>
            <IconWebhook /> Webhook
          </button>
          <button className="export-option" onClick={() => handleExport("email")}>
            <IconMail /> Email
          </button>
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

export default function QueueViewer({ item, onClose, onExport }) {
  const { user } = useAuth();
  const extraction = item?.result ?? {};
  const metadata = extraction.metadata ?? {};
  const segments = extraction.segments ?? [];

  useEffect(() => {
    if (!item) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [item, onClose]);

  if (!item) return null;

  const overlay = (
    <div className="queue-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="queue-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="queue-header">
          <div className="queue-header-left">
            <h2 className="queue-header-title">{item.name}</h2>
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
          {item.error && !segments.length && (
            <div className="error-box">
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px", marginTop: 0 }}>Processing Error</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{item.error}</p>
            </div>
          )}

          {segments.length === 0 && !item.error && (
            <div className="empty-state">No extracted fields available.</div>
          )}

          {segments.map((segment, index) => {
            const isTable = shouldRenderAsTable(segment);
            return (
              <div key={index} className="queue-segment">
                <h3 className="queue-segment-title">{segment.segment_name}</h3>
                {isTable ? (
                  <DataTable fields={segment.fields || []} />
                ) : (
                  <div>
                    {(segment.fields || []).map((field, idx) => (
                      <KVRow key={idx} label={field.label} value={field.value} confidence={field.confidence} />
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
            <IconDownload /> Export or send this extraction
          </div>
          <ExportDropdown item={item} segments={segments} onExport={onExport} user={user} />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}