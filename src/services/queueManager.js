// src/services/queueManager.js
const API_BASE = import.meta.env.VITE_API_URL || "/.netlify/functions";

function getGuestId() {
  let id = localStorage.getItem('precifio_guest_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('precifio_guest_id', id); }
  return id;
}

// src/services/queueManager.js
// Add this helper at the top of the file
function getDeviceFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return String(hash);
}


function getAuthHeaders() {
  const token = localStorage.getItem("precifio_token");
  const headers = token
    ? { Authorization: "Bearer " + token }
    : { "X-Guest-Id": getGuestId() };
  
  headers["X-Device-Fingerprint"] = getDeviceFingerprint();
  return headers;
}


async function pollExistingJob(jobId, onProgress) {
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 30000;
  const pollUrl = `${API_BASE}/check-job?jobId=${encodeURIComponent(jobId)}`;
  const startTime = Date.now();

  onProgress?.({ stage: "processing", progress: 50, jobId, recovering: true });

  while (Date.now() - startTime < MAX_POLL_TIME) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    let pollRes;
    try { pollRes = await fetch(pollUrl, { method: "GET", headers: getAuthHeaders() }); }
    catch { continue; }

    if (pollRes.status === 200) {
      const data = await pollRes.json();
      if (data.status === "completed" || data.success) {
        onProgress?.({ stage: "saving", progress: 95, jobId, recovering: true });
        return data;
      }
    }

    if (pollRes.status === 202) {
      onProgress?.({ stage: "processing", progress: 70, jobId, recovering: true });
      continue;
    }

    if (pollRes.status === 404) {
      const error = new Error("Extraction job could not be found.");
      error.status = 404; error.code = "JOB_NOT_FOUND"; error.jobId = jobId; throw error;
    }

    if (pollRes.status === 409) {
      const data = await pollRes.json().catch(() => ({}));
      const error = new Error(data.error || "Extraction stale. Starting fresh.");
      error.status = 409; error.code = data.code || "JOB_STALE"; error.jobId = jobId; throw error;
    }

    if (pollRes.status === 500) {
      const err = await pollRes.json().catch(() => ({}));
      const error = new Error(err.error || err.message || "Extraction failed.");
      error.status = 500; error.code = err.code || null; error.jobId = jobId; throw error;
    }
  }

  const error = new Error("Extraction is still processing. Please try again.");
  error.status = 202; error.code = "EXTRACTION_TIMEOUT"; error.jobId = jobId; error.recoverable = true;
  throw error;
}

async function recoverExistingJob(jobId, onProgress) {
  if (!jobId) return null;
  try { return await pollExistingJob(jobId, onProgress); }
  catch (error) {
    console.warn("Recovery did not complete:", error.message);
    if (error.status === 404 || error.code === "JOB_STALE") return null;
    throw error;
  }
}

async function uploadWithPoll(url, file, onProgress, jobId = null) {
  const MAX_RETRIES = 3;
  const FETCH_TIMEOUT = 28000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const requestHeaders = { ...getAuthHeaders() };
      if (jobId) requestHeaders["X-Extraction-Job-Id"] = jobId;

      const res = await fetch(url, { method: "POST", headers: requestHeaders, body: formData, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 202) {
        const data = await res.json();
        if (!data.jobId) { const error = new Error("No jobId returned."); error.code = "JOB_ID_MISSING"; throw error; }
        onProgress?.({ stage: "processing", progress: 50, jobId: data.jobId });
        return await pollExistingJob(data.jobId, onProgress);
      }

      if (res.ok) return await res.json();

      let data = {};
      try { data = await res.json(); } catch {}
      const error = new Error(data.error || data.message || "Extraction failed.");
      error.status = res.status; error.code = data.code || null;
      error.required = data.required || null; error.available = data.available || null;
      error.isGuest = data.isGuest || false;
      error.jobId = data.jobId || data.extractionId || jobId || null;
      error.extractionId = data.extractionId || data.jobId || jobId || null;
      throw error;

    } catch (error) {
      clearTimeout(timeoutId);
      const isRetryable = error.name === "AbortError" || /timeout|network|failed to fetch/i.test(error.message);
      if (isRetryable && attempt < MAX_RETRIES) {
        onProgress?.({ stage: "processing", progress: 50, recovering: true });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Extraction failed after multiple attempts.");
}

// src/services/queueManager.js
// ... existing code above stays the same ...

class QueueManager {
  async process(file, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const jobId = options.jobId || null;

    if (jobId) {
      const recovered = await recoverExistingJob(jobId, onProgress);
      if (recovered) {
        if (recovered.success && recovered.metadata?.creditsUsed > 0 && recovered.metadata?.newBalance !== undefined) {
          window.dispatchEvent(new CustomEvent("creditsUpdated", { detail: { newBalance: recovered.metadata.newBalance } }));
        }
        return recovered;
      }
    }

    onProgress({ stage: "uploading", progress: 5 });
    onProgress({ stage: "sending", progress: 15 });

    const result = await uploadWithPoll(API_BASE + "/extract", file, onProgress, jobId);

    onProgress({ stage: "saving", progress: 95 });
    onProgress({ stage: "completed", progress: 100 });

    if (result.success && result.metadata?.creditsUsed > 0 && result.metadata?.newBalance !== undefined) {
      window.dispatchEvent(new CustomEvent("creditsUpdated", { detail: { newBalance: result.metadata.newBalance } }));
    }
    return result;
  }

  // NEW: Recover a job without needing the file object.
  // Called on mount for items stuck in "processing".
  async recoverJob(jobId, onProgress) {
    if (!jobId) return null;
    const recovered = await recoverExistingJob(jobId, onProgress);
    if (recovered) {
      if (recovered.success && recovered.metadata?.creditsUsed > 0 && recovered.metadata?.newBalance !== undefined) {
        window.dispatchEvent(new CustomEvent("creditsUpdated", { detail: { newBalance: recovered.metadata.newBalance } }));
      }
      return recovered;
    }
    return null;
  }
}

const queueManager = new QueueManager();
export default queueManager;