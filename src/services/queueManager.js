// src/services/queueManager.js

const API_BASE = import.meta.env.VITE_API_URL || "/.netlify/functions";

function getGuestId() {
  let id = localStorage.getItem('precifio_guest_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('precifio_guest_id', id);
  }
  return id;
}

async function uploadWithPoll(url, file, onProgress, jobId = null) {
  const MAX_RETRIES = 3;
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 120000;
  const FETCH_TIMEOUT = 28000;

  // ── SNAPSHOT AUTH STATE ONCE PER UPLOAD ──
  const token = localStorage.getItem("precifio_token");
const authHeaders = token
  ? { Authorization: "Bearer " + token }
  : { "X-Guest-Id": getGuestId() };

  // ─────────────────────────────────────────────────────────────
  // Helper: poll an existing extraction job until it completes.
  // This path NEVER starts another extraction and NEVER charges.
  // ─────────────────────────────────────────────────────────────
  async function pollExistingJob(jobId) {
    if (!jobId) {
      throw new Error("No extraction job ID available for recovery.");
    }

    const pollUrl = `${API_BASE}/check-job?jobId=${encodeURIComponent(jobId)}`;
    const startTime = Date.now();

    onProgress?.({
      stage: "processing",
      progress: 50,
      jobId,
      recovering: true
    });

    while (Date.now() - startTime < MAX_POLL_TIME) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

      let pollRes;

      try {
        pollRes = await fetch(pollUrl, {
          method: "GET",
          headers: authHeaders
        });
      } catch (pollError) {
        
        continue;
      }

      if (pollRes.status === 200) {
        const data = await pollRes.json();

        if (data.status === "completed" || data.success) {
          onProgress?.({
            stage: "processing",
            progress: 95,
            jobId,
            recovering: true
          });

          return data;
        }
      }

      if (pollRes.status === 202) {
        onProgress?.({
          stage: "processing",
          progress: 70,
          jobId,
          recovering: true
        });

        continue;
      }

      if (pollRes.status === 404) {
  const error = new Error("Extraction job could not be found.");
  error.status = 404;
  error.code = "JOB_NOT_FOUND";
  error.jobId = jobId;
  throw error;
 }

      if (pollRes.status === 500) {
  const err = await pollRes.json().catch(() => ({}));

  const error = new Error(
    err.error ||
    err.message ||
    "Extraction failed."
  );

  error.status = 500;
  error.code = err.code || null;
  error.jobId = jobId;

  throw error;
}
    }

    const error = new Error(
  "Extraction is still processing. Please try again."
);

error.status = 202;
error.code = "EXTRACTION_TIMEOUT";
error.jobId = jobId;
error.recoverable = true;

throw error;
  }

  async function recoverExistingJob(jobId) {
  if (!jobId) return null;

  try {
    return await pollExistingJob(jobId);
  } catch (error) {
    console.warn(
      "Existing extraction recovery did not complete:",
      error.message
    );

    // Only allow a brand-new extraction if the old job
    // genuinely does not exist anymore.
    if (error.status === 404) {
      return null;
    }

    throw error;
  }
}

  // ─────────────────────────────────────────────────────────────
  // Normal extraction request
  // ─────────────────────────────────────────────────────────────
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const requestHeaders = {
     ...authHeaders
     };

    if (jobId) {
     requestHeaders["X-Extraction-Job-Id"] = jobId;
     }

      const res = await fetch(url, {
        method: "POST",
        headers: requestHeaders,
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // ── 202 = accepted, start polling ──
     if (res.status === 202) {
  const data = await res.json();
  const returnedJobId = data.jobId;

  if (!returnedJobId) {
    const error = new Error("No jobId returned for polling.");
    error.code = "JOB_ID_MISSING";
    throw error;
  }

  onProgress?.({
    stage: "processing",
    progress: 50,
    jobId: returnedJobId
  });

  return await pollExistingJob(returnedJobId);
}

      // ── 200 = immediate completion ──
      if (res.ok) {
        return await res.json();
      }

      // ── Error handling ──
      let data = {};

      try {
        data = await res.json();
      } catch {}

      const error = new Error(
        data.error ||
        data.message ||
        "Extraction failed."
      );

 error.status = res.status;
error.code = data.code || null;
error.required = data.required || null;
error.available = data.available || null;
error.isGuest = data.isGuest || false;

error.jobId =
  data.jobId ||
  data.extractionId ||
  jobId ||
  null;

error.extractionId =
  data.extractionId ||
  data.jobId ||
  jobId ||
  null;

throw error;

    } catch (error) {
      clearTimeout(timeoutId);

      const isRetryable =
        error.name === "AbortError" ||
        error.message?.toLowerCase().includes("timeout") ||
        error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("failed to fetch");

      if (isRetryable && attempt < MAX_RETRIES) {
        onProgress?.({
          stage: "processing",
          progress: 50,
          recovering: true
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Extraction failed after multiple attempts.");
}

class QueueManager {
    async process(file, options) {
const onProgress =
options && options.onProgress
? options.onProgress
: function () {};

const jobId =
options && options.jobId
? options.jobId
: null;

if (jobId) {
  const recovered = await recoverExistingJob(jobId);

  if (recovered) {
    return recovered;
  }
}

onProgress({
  stage: "uploading",
  progress: 5
});

    onProgress({
      stage: "sending",
      progress: 15
    });

    const result = await uploadWithPoll(
  API_BASE + "/extract",
  file,
  onProgress,
  jobId
   );

    onProgress({
      stage: "saving",
      progress: 95
    });

    onProgress({
      stage: "completed",
      progress: 100
    });

    if (
      result.success &&
      result.metadata?.creditsUsed > 0 &&
      result.metadata?.newBalance !== undefined
    ) {
      window.dispatchEvent(
        new CustomEvent("creditsUpdated", {
          detail: {
            newBalance: result.metadata.newBalance
          }
        })
      );
    }

    return result;
  }
}

const queueManager = new QueueManager();

export default queueManager;