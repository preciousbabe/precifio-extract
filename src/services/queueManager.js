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

async function upload(url, file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error('Server returned an invalid response.');
  }

  if (!response.ok) {
    const error = new Error(data.error || data.message || 'Extraction failed.');
    error.status = response.status;
    error.code = data.code || null;
    error.required = data.required || null;
    error.available = data.available || null;
    error.isGuest = data.isGuest || false;
    throw error;
  }

  return data;
}

class QueueManager {
  async process(file, options) {
    const onProgress = (options && options.onProgress) ? options.onProgress : function() {};

    onProgress({ stage: 'uploading', progress: 5 });
    onProgress({ stage: 'sending', progress: 15 });

    const result = await upload(API_BASE + '/extract', file);

    onProgress({ stage: 'processing', progress: 75 });
    onProgress({ stage: 'saving', progress: 95 });
    onProgress({ stage: 'completed', progress: 100 });

    // ✅ Emit event for real-time credit update (no API call)
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