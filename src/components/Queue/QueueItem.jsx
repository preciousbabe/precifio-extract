// src/components/Queue/QueueItem.jsx

import QueueProgress from "./QueueProgress";
import { useAuth } from "../../hooks/useAuth";

export default function QueueItem({ item, queue }) {
  const { isGuest, requireAuth } = useAuth();
const isFailed = item.status === "failed";
const isCompleted = item.status === "completed";
const isProcessing = item.status === "processing";
const isRecoverable = isFailed && !!item.extractionId;
  const canRemove = !queue.processing || isCompleted || isFailed;

  // Check if this item failed due to guest limit
  const isGuestLimitError = item.error && (
    item.error.includes('GUEST_LIMIT_REACHED') || 
    item.error.includes('Free extraction used')
  );

  const handleView = () => {
    if (isGuest && isGuestLimitError) {
      requireAuth('signup');
      return;
    }
    
    // Guest can view first result normally
    queue.selectItem(item);
  };

  const handleAction = () => {
  if (isGuest) {
    requireAuth("signup");
    return;
  }

  queue.retryItem(item.id);
};

  return (
    <div className={`queue-item ${item.status}`}>
      <div className="queue-item-header">
        <div className="queue-item-left">
          <input
            type="checkbox"
            className="queue-item-checkbox"
            checked={item.selected || false}
            onChange={() => queue.toggleSelection(item.id)}
          />
          <div className="queue-item-info">
            <strong>{item.name}</strong>
            <div className="queue-meta">
              {(item.size / 1024).toFixed(1)} KB
              {isGuest && isCompleted && (
                <span className="guest-badge">Free Preview</span>
              )}
            </div>
          </div>
        </div>

        <div className="queue-actions">
          {/* VIEW BUTTON */}
          {(isCompleted || isFailed) && (
            <button 
              onClick={handleView} 
              className={`queue-btn ${isGuestLimitError ? 'primary' : ''}`}
            >
              {isGuestLimitError ? '🔒 Sign Up to View' : 
               isCompleted ? 'View Results' : 'View Error'}
            </button>
          )}

          {/* RETRY / SIGN UP */}
          {isFailed && !isGuestLimitError && (
    <button
    onClick={() => queue.retryItem(item.id)}
    className="queue-btn warning"
   >
    {isRecoverable ? "↻ Recover Result" : "↻ Retry"}
   </button>
   )}

          {isGuestLimitError && (
            <button onClick={() => requireAuth('signup')} className="queue-btn primary">
              Get 10 Free Credits
            </button>
          )}

          {/* REMOVE */}
          {canRemove && (
            <button onClick={() => queue.removeItem(item.id)} className="queue-btn danger">
              Remove
            </button>
          )}
        </div>
      </div>

      <QueueProgress progress={item.progress} status={item.status} />
    </div>
  );
}