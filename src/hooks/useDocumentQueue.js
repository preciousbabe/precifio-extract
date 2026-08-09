// src/hooks/useDocumentQueue.js
// Owns the document queue state.
// No extraction logic lives here.

import { useState, useCallback, useMemo } from "react";

export function useDocumentQueue() {
  //----------------------------------------------------
  // Queue State
  //----------------------------------------------------

  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  //----------------------------------------------------
  // Helpers
  //----------------------------------------------------

  const createQueueItem = (file) => ({
  id: crypto.randomUUID(),
  file,
  name: file.name,
  size: file.size,
  type: file.type,

  // Queue lifecycle
  status: "queued",
  progress: 0,

  // Extraction result
  result: null,
  extractedText: "",

  // Error state
  error: null,
  errorCode: null,
  needsAction: null,

  // Backend job identity
  // Preserved across retries so a completed backend job
  // can be recovered instead of treated as a new extraction.
  jobId: null,
  extractionId: null,

  // Timing
  startedAt: null,
  completedAt: null,

  // Retry / recovery state
  retryCount: 0,
  recovering: false,

  selected: false
});

  //----------------------------------------------------
  // Add files
  //----------------------------------------------------

  const addFiles = useCallback((files) => {
    const queueItems = Array.from(files).map(createQueueItem);
    setItems(prev => [...prev, ...queueItems]);
  }, []);

  //----------------------------------------------------
  // Replace queue
  //----------------------------------------------------

  const replaceQueue = useCallback((files) => {
    setItems(Array.from(files).map(createQueueItem));
    setSelectedItem(null);
    setCurrentIndex(-1);
    setSelectedIds(new Set());
  }, []);

  //----------------------------------------------------
  // Selection (multi-select for mobile/batch)
  //----------------------------------------------------

  const toggleSelection = useCallback((id) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, selected: !item.selected }
          : item
      )
    );

    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(items.map(i => i.id));
    setSelectedIds(allIds);
    setItems(prev => prev.map(item => ({ ...item, selected: true })));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setItems(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  //----------------------------------------------------
  // Remove item
  //----------------------------------------------------

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setSelectedItem(prev => (prev?.id === id ? null : prev));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  //----------------------------------------------------
  // Remove selected items
  //----------------------------------------------------

  const removeSelected = useCallback(() => {
    setItems(prev => prev.filter(item => !item.selected));
    setSelectedIds(new Set());
    setSelectedItem(prev => (prev && prev.selected ? null : prev));
  }, []);

  //----------------------------------------------------
  // Update item
  //----------------------------------------------------

  const updateItem = useCallback((id, updates) => {
    setItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    );

    setSelectedItem(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  //----------------------------------------------------
  // Retry single item
  //----------------------------------------------------

 const retryItem = useCallback((id) => {
  setItems(prev =>
    prev.map(item => {
      if (item.id !== id) return item;

      return {
        ...item,

        // Put it back into the queue.
        status: "queued",
        progress: 0,

        // Clear the visible error.
        error: null,
        errorCode: null,
        needsAction: null,

        startedAt: null,
        completedAt: null,
        retryCount: (item.retryCount || 0) + 1,
        recovering: true,
        result: null,
        extractedText: ""
      };
    })
  );
}, []);

  //----------------------------------------------------
  // Retry all failed
  //----------------------------------------------------

  const retryFailed = useCallback(() => {
  setItems(prev =>
    prev.map(item => {
      if (item.status !== "failed") return item;

      return {
        ...item,

        status: "queued",
        progress: 0,

        error: null,
        errorCode: null,
        needsAction: null,

        // Preserve backend job identity and previous result.
        // queueManager/backend will determine whether the
        // existing job can be recovered without another AI call.
        startedAt: null,
        completedAt: null,

        retryCount: (item.retryCount || 0) + 1,
        recovering: true
      };
    })
  );
}, []);


  //----------------------------------------------------
  // Viewer
  //----------------------------------------------------

  const selectItem = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  //----------------------------------------------------
  // Queue cleanup
  //----------------------------------------------------

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(item => item.status !== "completed"));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setSelectedItem(null);
    setCurrentIndex(-1);
    setProcessing(false);
    setPaused(false);
    setSelectedIds(new Set());
  }, []);

  //----------------------------------------------------
  // Controls
  //----------------------------------------------------

  const start = useCallback(() => {
    setProcessing(true);
    setPaused(false);
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const stop = useCallback(() => {
    setProcessing(false);
    setPaused(false);
    setCurrentIndex(-1);
  }, []);

  //----------------------------------------------------
  // Statistics
  //----------------------------------------------------

const stats = useMemo(() => {
  const queued = items.filter(i => i.status === "queued").length;

  const processingStatuses = new Set([
    "uploading",
    "sending",
    "processing",
    "extracting",
    "ocr",
    "ai",
    "saving"
  ]);

  const processingCount = items.filter(
    i => processingStatuses.has(i.status)
  ).length;

  const completed = items.filter(i => i.status === "completed").length;
  const failed = items.filter(i => i.status === "failed").length;
  const selectedCount = selectedIds.size;

  return {
    total: items.length,
    queued,
    processing: processingCount,
    completed,
    failed,
    selected: selectedCount
  };
}, [items, selectedIds]);

  //----------------------------------------------------
  // Public API
  //----------------------------------------------------

  return {
    items,
    selectedItem,
    currentIndex,
    processing,
    paused,
    selectedIds,
    stats,
    addFiles,
    replaceQueue,
    removeItem,
    removeSelected,
    updateItem,
    selectItem,
    toggleSelection,
    selectAll,
    deselectAll,
    retryItem,
    clearCompleted,
    clearAll,
    retryFailed,
    start,
    pause,
    resume,
    stop,
    setCurrentIndex
  };
}