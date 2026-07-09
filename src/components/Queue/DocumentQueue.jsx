// src/components/Queue/DocumentQueue.jsx

import QueueToolbar from "./QueueToolbar";
import QueueSummary from "./QueueSummary";
import QueueItem from "./QueueItem";
import QueueViewer from "./QueueViewer";

export default function DocumentQueue({ queue }) {
  if (queue.items.length === 0) {
    return null;
  }

  const hasSelection = queue.selectedIds.size > 0;

  return (
    <div className="document-queue">
      <QueueToolbar
        stats={queue.stats}
        isProcessing={queue.processing}
        isPaused={queue.paused}
        hasSelection={hasSelection}
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
          <QueueItem
            key={item.id}
            item={item}
            queue={queue}
          />
        ))}
      </div>

      <QueueViewer
        item={queue.selectedItem}
        onClose={() => queue.selectItem(null)}
      />
    </div>
  );
}