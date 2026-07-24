// src/components/Queue/QueueSummary.jsx
// Queue statistics summary.

import React from "react";

export default function QueueSummary({
  stats = {}
}) {
  const {
    total = 0,
    queued = 0,
    processing = 0,
    completed = 0,
    failed = 0,
    selected = 0
  } = stats;

  const processed = completed + failed;

  const progress = total > 0
    ? Math.round((processed / total) * 100)
    : 0;

  return (
    <div className="queue-summary">
      <div className="queue-summary-card">
        <div className="queue-summary-number">{total}</div>
        <div className="queue-summary-label">Total Files</div>
      </div>

      <div className="queue-summary-card">
        <div className="queue-summary-number">{queued}</div>
        <div className="queue-summary-label">Queued</div>
      </div>

      <div className="queue-summary-card">
        <div className="queue-summary-number">{processing}</div>
        <div className="queue-summary-label">Processing</div>
      </div>

      <div className="queue-summary-card">
        <div className="queue-summary-number">{completed}</div>
        <div className="queue-summary-label">Completed</div>
      </div>

      <div className="queue-summary-card">
        <div className="queue-summary-number">{failed}</div>
        <div className="queue-summary-label">Failed</div>
      </div>

      {selected > 0 && (
        <div className="queue-summary-card selected">
          <div className="queue-summary-number">{selected}</div>
          <div className="queue-summary-label">Selected</div>
        </div>
      )}

      <div className="queue-overall-progress">
        <div className="queue-overall-header">
          <span>Overall Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="queue-overall-track">
          <div
            className="queue-overall-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

