// src/components/Queue/QueueViewer.jsx
// Full-screen overlay panel — renders via portal to document.body

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { exportAsJSON, exportAsCSV, exportAsExcel, exportAsPDF, exportAsXero, exportAsQuickBooks, sendToWebhook, sendEmail, copyToClipboard } from "../../utils/export-utils";

// ─── Inline Styles ─────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    width: "100vw",
    height: "100dvh",
    background: "rgba(0,0,0,.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    zIndex: 99999,
    overflow: "hidden",
    padding: 0,
  },

  card: {
    background: "#fff",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 0,
    boxShadow: "none",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    padding: "clamp(14px,2vw,26px)",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
    flexShrink: 0,
    flexWrap: "wrap",
  },

  headerLeft: {
    flex: 1,
    minWidth: 0,
  },

  headerTitle: {
    margin: 0,
    fontWeight: 700,
    color: "#111827",
    fontSize: "clamp(18px,2vw,28px)",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  headerSubtitle: {
    marginTop: "6px",
    color: "#6b7280",
    fontSize: "clamp(13px,1.2vw,15px)",
    lineHeight: 1.5,
    wordBreak: "break-word",
  },

  closeBtn: {
    width: "42px",
    height: "42px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: "10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  metaBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    padding: "12px clamp(14px,2vw,26px)",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "13px",
    flexShrink: 0,
  },

  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
  },

  metaDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
  },

  metaError: {
    color: "#dc2626",
    fontWeight: 600,
  },

  body: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "clamp(16px,2vw,30px)",
    background: "#fff",
    WebkitOverflowScrolling: "touch",
  },

  segment: {
    marginBottom: "32px",
  },

  segmentTitle: {
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: "#6b7280",
    paddingBottom: "12px",
    borderBottom: "2px solid #e5e7eb",
    marginBottom: "16px",
  },

  kvRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "14px 0",
    borderBottom: "1px solid #f3f4f6",
    flexWrap: "wrap",
  },

  kvLabel: {
    flex: "0 0 180px",
    fontWeight: 600,
    color: "#4b5563",
    fontSize: "14px",
  },

  kvValue: {
    flex: 1,
    minWidth: "220px",
    fontSize: "14px",
    lineHeight: 1.6,
    wordBreak: "break-word",
  },

  kvConfidence: {
    flexShrink: 0,
    padding: "4px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    background: "#dcfce7",
    color: "#15803d",
  },

  dataTable: {
    width: "100%",
    borderCollapse: "collapse",
    display: "block",
    overflowX: "auto",
    whiteSpace: "nowrap",
  },

  tableHead: {
    background: "#f9fafb",
  },

  tableTh: {
    padding: "14px",
    borderBottom: "2px solid #e5e7eb",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: 700,
    background: "#f9fafb",
  },

  tableTd: {
    padding: "14px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
  },

  exportBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    padding: "16px clamp(14px,2vw,26px)",
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    flexShrink: 0,
  },

  exportLabel: {
    fontSize: "14px",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  exportWrap: {
    position: "relative",
    maxWidth: "100%",
  },

  exportOption: {
  display: "flex",
  alignItems: "center",
  gap: "14px",

  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",

  padding: "13px 14px",

  borderRadius: "12px",

  cursor: "pointer",

  color: "#111827",

  fontSize: "14px",

  fontWeight: 500,

  transition: "all .2s ease",

  fontFamily: "inherit",
},


 exportTrigger: {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 18px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  transition: "all .25s ease",
  boxShadow: "0 8px 20px rgba(37,99,235,.25)",
},

exportHeader: {
  padding: "14px 14px 8px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: "#9ca3af",
},

exportDivider: {
  height: "1px",
  background: "#edf2f7",
  margin: "10px 0",
},

  exportMenu: {
  position: "absolute",
  bottom: "calc(100% + 12px)",
  right: 0,
  width: "min(360px,95vw)",
  maxHeight: "70vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 30px 60px rgba(0,0,0,.18)",
  padding: "10px",
  zIndex: 999,
},


  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fee2e2",
    borderRadius: "12px",
    padding: "20px",
  },

  emptyState: {
    padding: "80px 20px",
    textAlign: "center",
    color: "#9ca3af",
  },

  nestedTable: {
    width: "100%",
    borderCollapse: "collapse",
  },

  nestedTh: {
    textAlign: "left",
    width: "35%",
    padding: "6px 0",
    color: "#6b7280",
  },

  nestedTd: {
    padding: "6px 0",
    wordBreak: "break-word",
  },

  nestedList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },

  nestedListItem: {
    padding: "6px 0",
    borderBottom: "1px solid #f3f4f6",
  },
};


// ─── Icons ──────────────────────────────────────────────────────────
const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconWebhook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 0 1 3.89-6.06"/><path d="m12.26 12.15 3.74-6.94a4 4 0 0 1 3.87-6.07"/><path d="M5.57 9.3c.66.27 1.45.19 2.03-.24l2.59-1.95a3 3 0 0 1 4.17.56l1.18 1.56"/>
  </svg>
);

const IconMail = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconCopy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconSlack = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
  </svg>
);

const IconXero = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 8l8 8"/><path d="M16 8l-8 8"/>
  </svg>
);

const IconQuickBooks = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 12h10"/><path d="M12 7v10"/>
  </svg>
);

const IconExcel = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/>
  </svg>
);

// ─── Helpers ────────────────────────────────────────────────────────

function shouldRenderAsTable(segment) {
  const fields = segment.fields || [];
  const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

  // Shape test: 2+ rows, every row a plain object, identical keys, >= 2 columns.
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
  if (t === "table") return shapeLooksTabular; // trust "table" only if shape agrees
  if (t === "detail") return false;
  return shapeLooksTabular; // legacy data with no segment_type
}


function getTableColumns(fields) {
  const firstVal = fields[0].value;
  if (firstVal && typeof firstVal === "object" && !Array.isArray(firstVal)) {
    return Object.keys(firstVal);
  }
  return ["value"];
}

function confidenceClass(pct) {
  if (pct >= 90) return "";
  if (pct >= 70) return "low";
  return "very-low";
}

function formatLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ─────────────────────────────────────────────────

function KVRow({ label, value, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  const confStyle = {
    ...styles.kvConfidence,
    ...(pct < 70 ? (pct < 50 ? styles.kvConfidenceVeryLow : styles.kvConfidenceLow) : {}),
  };

  return (
    <div style={styles.kvRow}>
      <div style={styles.kvLabel}>{label}</div>
      <div style={styles.kvValue}>{renderValue(value)}</div>
      <div style={confStyle}>{pct}%</div>
    </div>
  );
}

function DataTable({ fields }) {
  const columns = getTableColumns(fields);
  const moneyCols = ["unit_price", "total", "subtotal", "discount", "tax", "shipping", "amount_due", "amount_paid", "balance_due", "price", "cost"];
  const numberCols = ["qty", "quantity", "amount", "count", "line_number"];

  return (
    <table style={styles.dataTable}>
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col} style={{ ...styles.tableTh, textAlign: moneyCols.includes(col) || numberCols.includes(col) ? "center" : "left" }}>
              {formatLabel(col)}
            </th>
          ))}
          <th style={{ ...styles.tableTh, textAlign: "center" }}>Conf.</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field, idx) => {
          const row = field.value || {};
          const pct = Math.round((field.confidence || 0) * 100);
          return (
            <tr key={idx} style={idx % 2 === 1 ? { background: "#fafafa" } : {}}>
              {columns.map(col => {
                const v = row[col];
                const isMoney = moneyCols.includes(col);
                const isNum = numberCols.includes(col);
                return (
                  <td key={col} style={{ ...styles.tableTd, textAlign: isMoney || isNum ? "right" : "left", fontWeight: isMoney ? 600 : 400 }}>
                    {renderValue(v)}
                  </td>
                );
              })}
              <td style={{ ...styles.tableTd, textAlign: "center", fontSize: "12px", fontWeight: 700, color: pct >= 90 ? "#16a34a" : pct >= 70 ? "#d97706" : "#dc2626" }}>{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every(v => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
    return (
      <ul style={styles.nestedList}>
        {value.map((v, i) => (
          <li key={i} style={styles.nestedListItem}>{renderValue(v)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <table style={styles.nestedTable}>
        <tbody>
          {Object.entries(value).map(([k, v]) => (
            <tr key={k}>
              <th style={styles.nestedTh}>{formatLabel(k)}</th>
              <td style={styles.nestedTd}>{renderValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return String(value);
}

// ─── Export Dropdown ──────────────────────────────────────────────

function ExportDropdown({ item, segments, onExport }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
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
        case "json": exportAsJSON(payload); break;
        case "csv": exportAsCSV(payload); break;
        case "excel": exportAsExcel(payload); break;
        case "pdf": await exportAsPDF(payload); break;
        case "xero": exportAsXero(payload); break;
        case "quickbooks": exportAsQuickBooks(payload); break;
        case "webhook": await sendToWebhook(payload); break;
        case "email": await sendEmail(payload); break;
        case "slack": await sendToWebhook(payload, { type: "slack" }); break;
        case "clipboard":
          await copyToClipboard(payload);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          break;
        default: break;
      }
      if (onExport) onExport(format);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  return (
    <div style={styles.exportWrap} ref={menuRef}>
      <button
        style={{
          ...styles.exportTrigger,
          ...(open ? { borderColor: "#3b82f6", boxShadow: "0 0 0 3px rgba(59,130,246,0.15)" } : {}),
        }}
        onClick={() => setOpen(!open)}
      >
        <IconDownload />
        <span>{exporting ? "Exporting…" : copied ? "Copied!" : "Export / Send"}</span>
        <span style={{ display: "inline-flex", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", marginLeft: "4px", opacity: 0.6 }}>
          <IconChevronUp />
        </span>
      </button>
      {open && (
        <div style={styles.exportMenu}>
          <div style={styles.exportHeader}>Download to device</div>
          <button style={styles.exportOption} onClick={() => handleExport("json")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconFile /> JSON (structured data)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("csv")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconFile /> CSV (spreadsheet)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("excel")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconExcel /> Excel (.xls)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("pdf")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconFile /> PDF (formatted report)
          </button>
          <div style={styles.exportDivider} />
          <div style={styles.exportHeader}>Accounting integrations</div>
          <button style={styles.exportOption} onClick={() => handleExport("xero")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconXero /> Xero (invoice JSON)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("quickbooks")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconQuickBooks /> QuickBooks (invoice JSON)
          </button>
          <div style={styles.exportDivider} />
          <div style={styles.exportHeader}>Send to system</div>
          <button style={styles.exportOption} onClick={() => handleExport("webhook")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconWebhook /> Webhook (API endpoint)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("email")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconMail /> Email (as attachment)
          </button>
          <button style={styles.exportOption} onClick={() => handleExport("slack")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <IconSlack /> Slack / Teams message
          </button>
          <div style={styles.exportDivider} />
          <div style={styles.exportHeader}>Copy</div>
          <button style={styles.exportOption} onClick={() => handleExport("clipboard")} onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
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
  if (!item) return null;

  const extraction = item.result || {};
  const metadata = extraction.metadata || {};
  const segments = extraction.segments || [];

  console.log(
  JSON.stringify(
    segments.find(s => s.segment_name === "Purchase Order Details").fields[0],
    null,
    2
  )
);

  // Lock body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const overlay = (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.headerTitle}>{item.name}</h2>
            <p style={styles.headerSubtitle}>{extraction.documentSummary || "No summary available"}</p>
          </div>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            title="Close"
            onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = "#fecaca"; e.currentTarget.style.color = "#ef4444"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#6b7280"; }}
          >
            <IconClose />
          </button>
        </div>

        {/* Meta bar */}
        <div style={styles.metaBar}>
          <span style={styles.metaItem}><span style={styles.metaDot} />Type: {item.type}</span>
          <span style={styles.metaItem}><span style={styles.metaDot} />Characters: {metadata.textLength || 0}</span>
          <span style={styles.metaItem}><span style={styles.metaDot} />🔒 Secured by Precifio AI</span>
          {item.error && <span style={{ ...styles.metaItem, ...styles.metaError }}><span style={{ ...styles.metaDot, background: "#ef4444" }} />Error: {item.error}</span>}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {item.error && !segments.length && (
            <div style={styles.errorBox}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px", marginTop: 0 }}>Processing Error</h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{item.error}</p>
            </div>
          )}

          {segments.length === 0 && !item.error && (
            <div style={styles.emptyState}>No extracted fields available.</div>
          )}

          {segments.map((segment, index) => {
            const isTable = shouldRenderAsTable(segment);
            return (
              <div key={index} style={styles.segment}>
                <h3 style={styles.segmentTitle}>{segment.segment_name}</h3>
                {isTable ? (
                  <DataTable fields={segment.fields || []} />
                ) : (
                  <div>
                    {(segment.fields || []).map((field, idx) => (
                      <KVRow
                        key={idx}
                        label={field.label}
                        value={field.value}
                        confidence={field.confidence}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Export bar */}
        <div style={styles.exportBar}>
          <div style={styles.exportLabel}>
            <IconDownload />
            Export or send this extraction
          </div>
          <ExportDropdown item={item} segments={segments} onExport={onExport} />
        </div>
      </div>
    </div>
  );

  // Render via portal to document.body to escape any parent containers
  return createPortal(overlay, document.body);
}
