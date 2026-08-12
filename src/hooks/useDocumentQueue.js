// src/hooks/useDocumentQueue.js
import { useState, useCallback, useMemo, useEffect } from "react";

const STORAGE_KEY = "precifio_queue_v1";

export function useDocumentQueue() {
  //----------------------------------------------------
  // Queue State (hydrated from localStorage)
  //----------------------------------------------------

  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore transient states:
        // - If user refreshed during upload/sending, we lost the File object.
        //   Those jobs are dead. Mark them so user knows to re-add.
        // - If user refreshed while processing and we have a jobId, keep it.
        return parsed.map((item) => {
          const wasInFlight = ["uploading", "sending"].includes(item.status);
          const hasJobId = !!item.jobId;

          if (wasInFlight && !hasJobId) {
            return {
              ...item,
              status: "failed",
              progress: 0,
              error: "Browser refreshed during upload. Please remove and re-add this file.",
              errorCode: "BROWSER_REFRESH",
              needsAction: null, // Cannot retry — no file, no jobId
              file: null,
            };
          }

          if (wasInFlight && hasJobId) {
            // We got the 202 but browser refreshed before polling completed.
            // Keep as processing so auto-recovery can pick it up.
            return { ...item, status: "processing", progress: 50, file: null };
          }

          // Everything else (queued, processing with jobId, completed, failed) restores as-is
          return { ...item, file: null };
        });
      }
    } catch {
      // Corrupted storage — start fresh
    }
    return [];
  });

  const [selectedItem, setSelectedItem] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [processing, setProcessing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  //----------------------------------------------------
  // Persist to localStorage (strip File objects)
  //----------------------------------------------------

  useEffect(() => {
    const persistable = items.map(({ file, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [items]);

  //----------------------------------------------------
  // Helpers
  //----------------------------------------------------

  const createQueueItem = (file) => ({
    id: crypto.randomUUID(),
    file, // This is the actual File object. Only exists in memory.
    name: file.name,
    size: file.size,
    type: file.type,
    status: "queued",
    progress: 0,
    result: null,
    extractedText: "",
    error: null,
    errorCode: null,
    needsAction: null,
    jobId: null,
    extractionId: null,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    recovering: false,
    selected: false,
  });

  //----------------------------------------------------
  // Add files
  //----------------------------------------------------

  const addFiles = useCallback((files) => {
    const queueItems = Array.from(files).map(createQueueItem);
    setItems((prev) => [...prev, ...queueItems]);
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
  // Selection
  //----------------------------------------------------

  const toggleSelection = useCallback((id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const allIds = new Set(items.map((i) => i.id));
    setSelectedIds(allIds);
    setItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setItems((prev) => prev.map((item) => ({ ...item, selected: false })));
  }, []);

  //----------------------------------------------------
  // Remove item
  //----------------------------------------------------

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItem((prev) => (prev?.id === id ? null : prev));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  //----------------------------------------------------
  // Remove selected
  //----------------------------------------------------

  const removeSelected = useCallback(() => {
    setItems((prev) => prev.filter((item) => !item.selected));
    setSelectedIds(new Set());
    setSelectedItem((prev) => (prev && prev.selected ? null : prev));
  }, []);

  //----------------------------------------------------
  // Update item
  //----------------------------------------------------

  const updateItem = useCallback((id, updates) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setSelectedItem((prev) => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  //----------------------------------------------------
  // Retry single item
  //----------------------------------------------------

  const retryItem = useCallback((id) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const forceFresh = item.needsAction === "retry-fresh";

        return {
          ...item,
          status: "queued",
          progress: 0,
          error: null,
          errorCode: null,
          needsAction: null,
          startedAt: null,
          completedAt: null,
          retryCount: (item.retryCount || 0) + 1,
          recovering: !forceFresh,
          result: null,
          extractedText: "",
          jobId: forceFresh ? null : item.jobId,
          extractionId: forceFresh ? null : item.extractionId,
        };
      })
    );
  }, []);

  //----------------------------------------------------
  // Retry all failed
  //----------------------------------------------------

  const retryFailed = useCallback(() => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== "failed") return item;
        const forceFresh = item.needsAction === "retry-fresh";
        return {
          ...item,
          status: "queued",
          progress: 0,
          error: null,
          errorCode: null,
          needsAction: null,
          startedAt: null,
          completedAt: null,
          retryCount: (item.retryCount || 0) + 1,
          recovering: !forceFresh,
          jobId: forceFresh ? null : item.jobId,
          extractionId: forceFresh ? null : item.extractionId,
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
    setItems((prev) => prev.filter((item) => item.status !== "completed"));
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
    const queued = items.filter((i) => i.status === "queued").length;
    const processingStatuses = new Set([
      "uploading", "sending", "processing", "extracting", "ocr", "ai", "saving", "recovering",
    ]);
    const processingCount = items.filter((i) => processingStatuses.has(i.status)).length;
    const completed = items.filter((i) => i.status === "completed").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const selectedCount = selectedIds.size;

    return {
      total: items.length,
      queued,
      processing: processingCount,
      completed,
      failed,
      selected: selectedCount,
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
    setCurrentIndex,
  };
}