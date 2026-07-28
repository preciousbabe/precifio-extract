// src/hooks/useQueueProcessor.js
// Processes queue items one at a time, sequentially.
// Handles 402 responses for guest limits and insufficient credits.

import { useEffect, useRef } from "react";
import queueManager from "../services/queueManager";


function createProgressSimulator(itemId, updateItem, itemsRef) {
  let interval = null;
  let timeout = null;

  const start = () => {
    updateItem(itemId, { status: "uploading", progress: 5 });

    timeout = setTimeout(() => {
      updateItem(itemId, { status: "sending", progress: 15 });

      let p = 15;
      interval = setInterval(() => {
        const current = itemsRef.current.find(i => i.id === itemId);
        if (!current || ["completed", "failed"].includes(current.status)) {
          clearInterval(interval);
          return;
        }
        p = Math.min(p + Math.random() * 2.5 + 0.3, 92);
        let stage = "processing";
        if (p > 80) stage = "ai";
        else if (p > 60) stage = "ocr";
        else if (p > 40) stage = "extracting";
        else if (p > 20) stage = "processing";

        updateItem(itemId, { progress: Math.round(p), status: stage });
      }, 700);
    }, 400);
  };

  const stop = () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };

  return { start, stop };
}


export function useQueueProcessor(queueApi) {
  const {
    items,
    processing,
    paused,
    setCurrentIndex,
    updateItem,
    stop
  } = queueApi;

  // Refs to always access latest values inside async function
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
    if (!item) return;

    setCurrentIndex(index);

    updateItem(item.id, {
      status: "uploading",
      progress: 0,
      error: null,
      startedAt: new Date().toISOString()
    });

    const simulator = createProgressSimulator(item.id, updateItem, itemsRef);
    simulator.start();

    try {
      const result = await queueManager.process(
        item.file,
        {
          onProgress(progress) {
            // Real backend progress overrides simulation
            updateItem(item.id, {
              progress: progress.progress,
              status: progress.stage
            });
          }
        }
      );

      simulator.stop();

      updateItem(item.id, {
        status: "completed",
        progress: 100,
        result,
        completedAt: new Date().toISOString()
      });

    } catch (err) {
      simulator.stop();
      console.error("Process error:", err.message, err.code);

      if (err.status === 402 || err.code === "GUEST_LIMIT_REACHED" || err.code === "INSUFFICIENT_CREDITS" || err.code === "GUEST_EXPIRED") {
        if (err.code === "GUEST_LIMIT_REACHED" || err.code === "GUEST_EXPIRED") {
          window.dispatchEvent(new CustomEvent("showAuthModal", {
            detail: { mode: "signup" }
          }));
        }
        if (err.code === "INSUFFICIENT_CREDITS") {
          window.dispatchEvent(new CustomEvent("showBuyCredits", {
            detail: {
              required: err.required || 1,
              available: err.available || 0,
              fileName: item.file.name
            }
          }));
        }

        updateItem(item.id, {
          status: "failed",
          error: err.message,
          errorCode: err.code,
          needsAction: err.code === "INSUFFICIENT_CREDITS" ? "buy-credits" : "signup",
          completedAt: new Date().toISOString()
        });

        queueApi.pause();
        return;
      }

      updateItem(item.id, {
        status: "failed",
        error: err.message,
        errorCode: err.code || null,
        completedAt: new Date().toISOString()
      });
    }
  }

// ── Replace the useEffect at the bottom ──

  useEffect(() => {
    if (!processingRef.current) return;
    if (pausedRef.current) return;
    if (isRunningRef.current) return;

    async function runNext() {
      const next = findNextQueued();
      if (next === -1) {
        stop();
        return;
      }

      isRunningRef.current = true;
      await processItem(next);
      isRunningRef.current = false;

      // Chain to next item without waiting for a dependency change
      if (processingRef.current && !pausedRef.current) {
        setTimeout(runNext, 0);
      }
    }

    runNext();
  }, [processing, paused, stop, setCurrentIndex, updateItem, queueApi]);
}