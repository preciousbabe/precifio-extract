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

function getAuthHeaders() {
  const headers = {};
  const token = localStorage.getItem('precifio_token');

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  } else {
    headers['X-Guest-Id'] = getGuestId();
  }

  return headers;
}

async function uploadWithPoll(url, file, onProgress) {
  const MAX_RETRIES = 3;
  const POLL_INTERVAL = 3000;
  const MAX_POLL_TIME = 60000;

  retryLoop: for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
            const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      // ✅ Recreate FormData fresh every attempt
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // 202 = processing, start polling
      if (res.status === 202) {
        const { jobId } = await res.json();
        onProgress?.({ stage: 'processing', progress: 50 });

        const startTime = Date.now();
        while (Date.now() - startTime < MAX_POLL_TIME) {
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          
          const pollRes = await fetch(`${API_BASE}/extract-poll?jobId=${jobId}`);
          if (pollRes.status === 200) {
            onProgress?.({ stage: 'processing', progress: 85 });
            // Job done — jump to next retryLoop iteration to re-POST /extract
            // and hit the idempotency cache for the final 200 response
            continue retryLoop;
          }
          if (pollRes.status === 500) {
            const err = await pollRes.json();
            throw new Error(err.error || 'Extraction failed');
          }
          // 202 = still processing, loop continues
        }
        throw new Error('Extraction timed out. Please try again.');
      }

      // 200 = done (fresh or cached)
      if (res.ok) return await res.json();

      // Error handling (402, 429, etc.)
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
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        if (attempt < MAX_RETRIES) {
          onProgress?.({ stage: 'processing', progress: 40 });
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
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

    // ✅ Emit event for real-time credit update
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