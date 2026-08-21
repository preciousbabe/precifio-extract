// src/hooks/useQueueProcessor.js
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
          clearInterval(interval); return;
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
  const stop = () => { clearTimeout(timeout); clearInterval(interval); };
  return { start, stop };
}

export function useQueueProcessor(queueApi) {
  const { items, processing, paused, setCurrentIndex, updateItem, stop } = queueApi;

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const processingRef = useRef(processing);
  processingRef.current = processing;
  const isRunningRef = useRef(false);

  //----------------------------------------------------
  // AUTO-RECOVERY: On mount, check any jobs stuck in "processing"
  //----------------------------------------------------

  useEffect(() => {
    async function checkStuckJobs() {
      const stuckItems = itemsRef.current.filter(
        (item) => item.status === "processing" && !!item.jobId
      );

      for (const item of stuckItems) {
        // Silently poll in background — no simulator needed
        try {
          const result = await queueManager.recoverJob(item.jobId, (progress) => {
            updateItem(item.id, {
              progress: progress.progress,
              status: progress.stage,
            });
          });

          if (result) {
            const recoveredJobId =
              result?.jobId || result?.extractionId || item.jobId || null;

            updateItem(item.id, {
              status: "completed",
              progress: 100,
              result,
              error: null,
              errorCode: null,
              needsAction: null,
              jobId: recoveredJobId,
              extractionId: result?.extractionId || recoveredJobId,
              completedAt: new Date().toISOString(),
              recovering: false,
            });
          }
        } catch (err) {
          // console.error("Auto-recovery failed for", item.id, err.message, err.code);

          if (err.code === "JOB_STALE" || err.status === 409) {
            updateItem(item.id, {
              status: "failed",
              error: err.message,
              errorCode: "JOB_STALE",
              needsAction: "retry-fresh",
              jobId: null,
              extractionId: null,
              recovering: false,
            });
          } else if (err.recoverable || err.code === "EXTRACTION_TIMEOUT") {
            // Still running in background. Leave as failed with recover option.
            updateItem(item.id, {
              status: "failed",
              error: err.message || "Extraction is still completing in the background.",
              errorCode: err.code || "EXTRACTION_TIMEOUT",
              needsAction: "recover",
              jobId: err.jobId || item.jobId || null,
              extractionId: err.extractionId || item.extractionId || item.jobId || null,
              recovering: false,
              completedAt: new Date().toISOString(),
            });
          } else {
            updateItem(item.id, {
              status: "failed",
              error: err.message,
              errorCode: err.code || null,
              needsAction: null,
              recovering: false,
              completedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    checkStuckJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  //----------------------------------------------------
  // Find next queued document
  //----------------------------------------------------

  const findNextQueued = () => {
    return itemsRef.current.findIndex((item) => item.status === "queued");
  };

  //----------------------------------------------------
  // Process one document (keep exactly as before)
  //----------------------------------------------------

 async function processItem(index) {
  const item = itemsRef.current[index];
  if (!item) return;

  setCurrentIndex(index);

  // ── Recovery mode: we have a jobId from a previous attempt ──
  const isRecoveryMode = item.recovering === true && !!item.jobId;

  updateItem(item.id, {
    status: isRecoveryMode ? "recovering" : "uploading",
    progress: isRecoveryMode ? 50 : 0,
    error: null,
    errorCode: null,
    needsAction: null,
    startedAt: new Date().toISOString(),
  });

  const simulator = createProgressSimulator(item.id, updateItem, itemsRef);

  // Only run fake progress simulator for fresh uploads.
  // Recovery polling provides its own real progress callbacks.
  if (!isRecoveryMode) {
    simulator.start();
  }

  try {
    const result = await queueManager.process(item.file, {
      jobId: item.jobId || item.extractionId || null,
      onProgress(progress) {
        updateItem(item.id, {
          progress: progress.progress,
          status: progress.stage,
        });
      },
    });

    if (!isRecoveryMode) simulator.stop();

    const recoveredJobId =
      result?.jobId ||
      result?.extractionId ||
      item.jobId ||
      item.extractionId ||
      null;

    updateItem(item.id, {
      status: "completed",
      progress: 100,
      result,
      error: null,
      errorCode: null,
      needsAction: null,
      jobId: recoveredJobId,
      extractionId: result?.extractionId || recoveredJobId,
      completedAt: new Date().toISOString(),
      recovering: false,
    });
  } catch (err) {
    if (!isRecoveryMode) simulator.stop();

    // console.error("Process error:", err.message, err.code, err.status, err.jobId);

    // ── STALE / FORCE FRESH ──
    if (err.code === "JOB_STALE") {
      updateItem(item.id, {
        status: "failed",
        error: err.message,
        errorCode: "JOB_STALE",
        needsAction: "retry-fresh",
        jobId: null,
        extractionId: null,
        recovering: false,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // ── RECOVERABLE TIMEOUT ──
    if (
      err.recoverable === true ||
      err.code === "EXTRACTION_TIMEOUT" ||
      err.code === "JOB_RECOVERY_AVAILABLE"
    ) {
      // If user has already tried recovery once, force a fresh upload.
      // Don't let them loop forever on a dead backend job.
      const alreadyTriedRecovery = (item.retryCount || 0) >= 1;

      if (alreadyTriedRecovery) {
        updateItem(item.id, {
          status: "failed",
          error: "Could not recover previous result. Click Retry Fresh to start again.",
          errorCode: "RECOVERY_FAILED",
          needsAction: "retry-fresh",
          jobId: null,
          extractionId: null,
          recovering: false,
          completedAt: new Date().toISOString(),
        });
        return;
      }

      const recoveredJobId =
        err.jobId || item.jobId || item.extractionId || null;

      updateItem(item.id, {
        status: "failed",
        progress: Math.max(item.progress || 0, 74),
        error:
          err.message || "Extraction is still completing in the background.",
        errorCode: err.code || "EXTRACTION_TIMEOUT",
        jobId: recoveredJobId,
        extractionId: recoveredJobId,
        needsAction: "recover",
        recovering: false,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    // ── CREDIT / GUEST ACTION REQUIRED ──
    if (
      err.status === 402 ||
      err.code === "GUEST_LIMIT_REACHED" ||
      err.code === "INSUFFICIENT_CREDITS" ||
      err.code === "GUEST_EXPIRED"
    ) {
      if (
        err.code === "GUEST_LIMIT_REACHED" ||
        err.code === "GUEST_EXPIRED"
      ) {
        window.dispatchEvent(
          new CustomEvent("showAuthModal", { detail: { mode: "signup" } })
        );
      }

      if (err.code === "INSUFFICIENT_CREDITS") {
        window.dispatchEvent(
          new CustomEvent("showBuyCredits", {
            detail: {
              required: err.required || 1,
              available: err.available || 0,
              fileName: item.file.name,
            },
          })
        );
      }

      updateItem(item.id, {
        status: "failed",
        error: err.message,
        errorCode: err.code,
        needsAction:
          err.code === "INSUFFICIENT_CREDITS" ? "buy-credits" : "signup",
        jobId: err.jobId || item.jobId || null,
        extractionId:
          err.extractionId || item.extractionId || item.jobId || null,
        completedAt: new Date().toISOString(),
        recovering: false,
      });

      queueApi.pause();
      return;
    }

    // ── GENUINE FAILURE ──
    updateItem(item.id, {
      status: "failed",
      progress: 100,
      error: err.message,
      errorCode: err.code || null,
      jobId: err.jobId || item.jobId || null,
      extractionId:
        err.extractionId || item.extractionId || item.jobId || null,
      needsAction: null,
      completedAt: new Date().toISOString(),
      recovering: false,
    });
  }
}


  //----------------------------------------------------
  // Main processor loop (keep exactly as before)
  //----------------------------------------------------

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

      try {
        await processItem(next);
      } finally {
        isRunningRef.current = false;
      }

      if (processingRef.current && !pausedRef.current) {
        setTimeout(runNext, 0);
      }
    }
    runNext();
  }, [processing, paused, stop, setCurrentIndex, updateItem, queueApi]);

}