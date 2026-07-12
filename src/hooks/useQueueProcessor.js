// src/hooks/useQueueProcessor.js
// Processes queue items one at a time, sequentially.
// Handles 402 responses for guest limits and insufficient credits.

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

    } catch (err) {
      console.error('Process error:', err.message, err.code);

      // Handle 402 payment/auth errors
      if (err.status === 402 || err.code === 'GUEST_LIMIT_REACHED' || err.code === 'INSUFFICIENT_CREDITS' || err.code === 'GUEST_EXPIRED') {
        
        // Guest limit reached or expired — show signup modal
        if (err.code === 'GUEST_LIMIT_REACHED' || err.code === 'GUEST_EXPIRED') {
          window.dispatchEvent(new CustomEvent('showAuthModal', {
            detail: { mode: 'signup' }
          }));
        }
        
        // Insufficient credits — show buy credits modal with context
        if (err.code === 'INSUFFICIENT_CREDITS') {
          window.dispatchEvent(new CustomEvent('showBuyCredits', {
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
          needsAction: err.code === 'INSUFFICIENT_CREDITS' ? 'buy-credits' : 'signup',
          completedAt: new Date().toISOString()
        });

        // Pause queue so user can take action
        queueApi.pause();
        return;
      }

      // All other errors
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

  }, [processing, paused, items, stop, setCurrentIndex, updateItem, queueApi]);
}