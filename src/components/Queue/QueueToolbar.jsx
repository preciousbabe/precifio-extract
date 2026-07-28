// src/components/Queue/QueueToolbar.jsx
import React from "react";
import ExportAllButton from "./ExportAllButton"; // ADD THIS

export default function QueueToolbar({
  stats = {},
  items = [], // ADD THIS PROP
  isProcessing = false,
  isPaused = false,
  hasSelection = false,
  onStart,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
  onRetryFailed,
  onSelectAll,
  onDeselectAll,
  onRemoveSelected
}) {
  const {
    queued = 0,
    completed = 0,
    failed = 0,
    selected = 0
  } = stats;

  return (
    <div className="queue-toolbar">
      <div className="queue-toolbar-left">
        {/* Playback controls */}
        {!isProcessing && queued > 0 && (
          <button className="queue-btn primary" onClick={onStart}>
            ▶ Start Queue
          </button>
        )}

        {isProcessing && !isPaused && (
          <button className="queue-btn" onClick={onPause}>
            ⏸ Pause
          </button>
        )}

        {isProcessing && isPaused && (
          <button className="queue-btn primary" onClick={onResume}>
            ▶ Resume
          </button>
        )}

        {isProcessing && (
          <button className="queue-btn danger" onClick={onCancel}>
            ✕ Cancel
          </button>
        )}
      </div>

      <div className="queue-toolbar-center">
        {/* ADD EXPORT ALL BUTTON HERE */}
        {completed > 0 && (
          <ExportAllButton items={items} />
        )}

        {/* Selection controls */}
        {selected > 0 ? (
          <>
            <span className="queue-selection-count">{selected} selected</span>
            <button className="queue-btn" onClick={onDeselectAll}>
              Deselect All
            </button>
            {!isProcessing && (
              <button className="queue-btn danger" onClick={onRemoveSelected}>
                Remove Selected
              </button>
            )}
          </>
        ) : (
          <button className="queue-btn" onClick={onSelectAll}>
            ☑ Select All
          </button>
        )}
      </div>

      <div className="queue-toolbar-right">
        {/* Batch actions */}
        {failed > 0 && (
          <button className="queue-btn warning" onClick={onRetryFailed}>
            ↻ Retry Failed ({failed})
          </button>
        )}

        {completed > 0 && (
          <button className="queue-btn" onClick={onClearCompleted}>
            🗑 Clear Completed ({completed})
          </button>
        )}
      </div>
    </div>
  );
}