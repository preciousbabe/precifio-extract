// src/components/Queue/DocumentQueue.jsx

import QueueToolbar from "./QueueToolbar";
import QueueSummary from "./QueueSummary";
import QueueItem from "./QueueItem";
import QueueViewer from "./QueueViewer";
import AuthModal from "../AuthModal"; 
import { useAuth } from "../../hooks/useAuth";

export default function DocumentQueue({ queue }) {
  const { isGuest, loading, showAuthModal, setShowAuthModal, authModalMode, requireAuth } = useAuth();

  if (queue.items.length === 0) return null;

  // Don't show guest banner while auth is still loading
  // This prevents the flash of "guest mode" after login
  const showGuestBanner = !loading && isGuest;

  return (
    <div className="document-queue">
      {/* Guest Banner — only show when auth is resolved and user is actually guest */}
      {showGuestBanner && (
        <div className="guest-banner">
          <div className="guest-banner-content">
            <span>👋 You're using Precifio as a guest — 1 free extraction</span>
            <button onClick={() => requireAuth('signup')} className="guest-banner-btn">
              Sign Up for 10 Free Credits
            </button>
          </div>
        </div>
      )}

      <QueueToolbar
        stats={queue.stats}
        isProcessing={queue.processing}
        isPaused={queue.paused}
        hasSelection={queue.selectedIds.size > 0}
        onStart={queue.start}
        onPause={queue.pause}
        onResume={queue.resume}
        onCancel={queue.stop}
        onClearCompleted={queue.clearCompleted}
        onRetryFailed={queue.retryFailed}
        onSelectAll={queue.selectAll}
        onDeselectAll={queue.deselectAll}
        onRemoveSelected={queue.removeSelected}
      />

      <QueueSummary stats={queue.stats} />

      <div className="queue-list">
        {queue.items.map(item => (
          <QueueItem key={item.id} item={item} queue={queue} />
        ))}
      </div>

      <QueueViewer
        item={queue.selectedItem}
        onClose={() => queue.selectItem(null)}
      />

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          mode={authModalMode}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}