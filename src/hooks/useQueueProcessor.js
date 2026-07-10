// src/hooks/useQueueProcessor.js
// Processes queue items one at a time, sequentially.

import { useEffect, useRef } from "react";
import queueManager from "../services/queueManager";

export function useQueueProcessor(queueApi) {
  const {
    items,
    processing,
    paused,
    setCurrentIndex,
    updateItem,
    stop
  } = queueApi;

  // Refs to always access latest values inside async functions
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const processingRef = useRef(processing);
  processingRef.current = processing;

  const isRunningRef = useRef(false);

  //----------------------------------------------------
  // Find next queued document
  //----------------------------------------------------

  const findNextQueued = () => {
    return itemsRef.current.findIndex(item => item.status === "queued");
  };

  //----------------------------------------------------
  // Process one document
  //----------------------------------------------------

  async function processItem(index) {
    const item = itemsRef.current[index];

    if (!item) {
      return;
    }

    setCurrentIndex(index);

    updateItem(item.id, {
      status: "processing",
      progress: 0,
      error: null,
      startedAt: new Date().toISOString()
    });

    try {
      const result = await queueManager.process(
        item.file,
        {
          onProgress(progress) {
            updateItem(item.id, {
              progress: progress.progress,
              status: progress.stage
            });
          }
        }
      );

      updateItem(item.id, {
        status: "completed",
        progress: 100,
        result,
        completedAt: new Date().toISOString()
      });

   // In processItem catch block:

} catch (err) {
  console.error('Process error:', err.message, err.code);
  
  updateItem(item.id, {
    status: "failed",
    error: err.message,
    errorCode: err.code || null,
    completedAt: new Date().toISOString()
  });
  }
  }

  //----------------------------------------------------
  // Queue loop — sequential, one at a time
  //----------------------------------------------------

  useEffect(() => {
    if (!processingRef.current) return;
    if (pausedRef.current) return;
    if (isRunningRef.current) return;

    const next = findNextQueued();

    if (next === -1) {
      stop();
      return;
    }

    isRunningRef.current = true;

    processItem(next).finally(() => {
      isRunningRef.current = false;
    });

  }, [processing, paused, items, stop, setCurrentIndex, updateItem]);
}