// src/components/Queue/QueueViewer.jsx
// Modal for viewing extracted text/results of a queue item.

import React from "react";

export default function QueueViewer({
  item,
  onClose
}) {
  if (!item) return null;

  const extraction = item.result || {};
  const metadata = extraction.metadata || {};
  const segments = extraction.segments || [];

  return (
    <div
      className="queue-viewer-overlay"
      onClick={onClose}
    >
      <div
        className="queue-viewer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="queue-viewer-header">
          <div>
            <h2>{item.name}</h2>
            <p>
              {extraction.documentSummary || "No summary available"}
            </p>
          </div>

          <button
            className="queue-viewer-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="queue-viewer-meta">
          <span>Type: {item.type}</span>
          <span>Characters: {metadata.textLength || 0}</span>
          <span> 🔒 Secured by Precifio AI Engine</span>
          {item.error && (
            <span className="queue-viewer-error">
              Error: {item.error}
            </span>
          )}
        </div>

        <div className="queue-viewer-body">
          {item.error && !segments.length && (
            <div className="queue-viewer-error-box">
              <h3>Processing Error</h3>
              <p>{item.error}</p>
            </div>
          )}

          {segments.length === 0 && !item.error && (
            <div className="queue-viewer-empty">
              No extracted fields available.
            </div>
          )}

          {segments.map((segment, index) => (
            <div
              key={index}
              className="queue-viewer-segment"
            >
              <h3>{segment.segment_name}</h3>

              {(segment.fields || []).length > 0 && (
                <table className="queue-viewer-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Value</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(segment.fields || []).map((field, idx) => (
                      <tr key={idx}>
                        <td className="queue-viewer-label">
                          {field.label}
                        </td>
                        <td className="queue-viewer-value">
                          {renderValue(field.value)}
                        </td>
                        <td className="queue-viewer-confidence">
                          {Math.round((field.confidence || 0) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderValue(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (value.every(v => typeof v === "string" || typeof v === "number")) {
      return value.join(", ");
    }
    return (
      <ul className="queue-viewer-list">
        {value.map((v, i) => (
          <li key={i}>{renderValue(v)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    return (
      <table className="queue-viewer-nested-table">
        <tbody>
          {Object.entries(value).map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{renderValue(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return String(value);
}