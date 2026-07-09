// src/components/Queue/QueueItem.jsx

import QueueProgress from "./QueueProgress";

export default function QueueItem({ item, queue }) {
  const isFailed = item.status === "failed";
  const isCompleted = item.status === "completed";
  const isProcessing = item.status === "processing";
  const canRemove = !queue.processing || isCompleted || isFailed;

  return (
    <div className={`queue-item ${item.status}`}>
      <div className="queue-item-header">
        <div className="queue-item-left">
          {/* Selection checkbox */}
          <input
            type="checkbox"
            className="queue-item-checkbox"
            checked={item.selected || false}
            onChange={() => queue.toggleSelection(item.id)}
            aria-label={`Select ${item.name}`}
          />

          <div className="queue-item-info">
            <strong>{item.name}</strong>
            <div className="queue-meta">
              {(item.size / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>

        <div className="queue-actions">
          {/* View result */}
          {(isCompleted || isFailed) && (
            <button
              onClick={() => queue.selectItem(item)}
              className="queue-btn"
            >
              {isCompleted ? "View" : "Details"}
            </button>
          )}

          {/* Retry failed */}
          {isFailed && (
            <button
              onClick={() => queue.retryItem(item.id)}
              className="queue-btn warning"
            >
              ↻ Retry
            </button>
          )}

          {/* Remove */}
          {canRemove && (
            <button
              onClick={() => queue.removeItem(item.id)}
              className="queue-btn danger"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <QueueProgress
        progress={item.progress}
        status={item.status}
      />
    </div>
  );
}