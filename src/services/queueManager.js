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

async function uploadWithPoll(url, file, onProgress) {
  const MAX_RETRIES = 3;
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 120000;
  const FETCH_TIMEOUT = 35000;

  // ── SNAPSHOT AUTH STATE ONCE PER UPLOAD ──
  const token = localStorage.getItem('precifio_token');
  const authHeaders = token
    ? { 'Authorization': 'Bearer ' + token }
    : { 'X-Guest-Id': getGuestId() };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // ── 202 = accepted, start polling ──
      if (res.status === 202) {
        const { jobId } = await res.json();
        if (!jobId) throw new Error('No jobId returned for polling.');

        onProgress?.({ stage: 'processing', progress: 50 });

        const pollUrl = `${API_BASE}/check-job?jobId=${jobId}`;
        const startTime = Date.now();

        while (Date.now() - startTime < MAX_POLL_TIME) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL));

          const pollRes = await fetch(pollUrl, { headers: authHeaders });

          if (pollRes.status === 200) {
            const data = await pollRes.json();
            if (data.status === 'completed') {
              onProgress?.({ stage: 'processing', progress: 90 });
              return data;
            }
          }

          if (pollRes.status === 500) {
            const err = await pollRes.json();
            throw new Error(err.error || err.message || 'Extraction failed');
          }
          // 202 = still processing, loop continues
        }

        throw new Error('Extraction timed out. Please try again.');
      }

      // ── 200 = immediate completion ──
      if (res.ok) {
        return await res.json();
      }

      // ── Error handling (402, 429, etc.) ──
      let data = {};
      try { data = await res.json(); } catch {}

      const error = new Error(data.error || data.message || 'Extraction failed.');
      error.status = res.status;
      error.code = data.code || null;
      error.required = data.required || null;
      error.available = data.available || null;
      error.isGuest = data.isGuest || false;
      throw error;

    } catch (error) {
      clearTimeout(timeoutId);

      const isRetryable = error.name === 'AbortError' ||
                          error.message?.includes('timeout') ||
                          error.message?.includes('network');

      if (isRetryable && attempt < MAX_RETRIES) {
        onProgress?.({ stage: 'processing', progress: 40 });
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      throw error;
    }
  }
}

class QueueManager {
  async process(file, options) {
    const onProgress = (options && options.onProgress) ? options.onProgress : function() {};

    onProgress({ stage: 'uploading', progress: 5 });
    onProgress({ stage: 'sending', progress: 15 });

    const result = await uploadWithPoll(API_BASE + '/extract', file, onProgress);

    onProgress({ stage: 'saving', progress: 95 });
    onProgress({ stage: 'completed', progress: 100 });

    if (result.success && result.metadata?.creditsUsed > 0 && result.metadata?.newBalance !== undefined) {
      window.dispatchEvent(new CustomEvent('creditsUpdated', {
        detail: { newBalance: result.metadata.newBalance }
      }));
    }

    return result;
  }
}

const queueManager = new QueueManager();

export default queueManager;