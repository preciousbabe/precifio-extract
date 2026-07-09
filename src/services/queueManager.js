// src/services/queueManager.js — Updated with ZIP handling

const API_BASE = import.meta.env.VITE_API_URL || "/.netlify/functions";

function isZip(file) {
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.name.toLowerCase().endsWith(".zip")
  );
}

async function upload(url, file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    body: formData
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || "Extraction failed.");
  }

  return data;
}

class QueueManager {
  async process(file, { onProgress = () => {} } = {}) {
    // If it's a ZIP, extract client-side and return special result
    if (isZip(file)) {
      return this.processZip(file, onProgress);
    }

    // Normal single-file processing
    onProgress({ stage: "uploading", progress: 5 });
    onProgress({ stage: "sending", progress: 15 });

    const result = await upload(`${API_BASE}/extract`, file);

    onProgress({ stage: "processing", progress: 75 });
    onProgress({ stage: "saving", progress: 95 });
    onProgress({ stage: "completed", progress: 100 });

    return result;
  }

  async processZip(file, onProgress) {
    onProgress({ stage: "uploading", progress: 5 });

    // Use JSZip to extract client-side
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);

    const extractedFiles = [];
    const skippedFiles = [];

    const entries = Object.values(zip.files).filter(entry => !entry.dir);

    onProgress({ stage: "extracting", progress: 20 });

    for (const entry of entries) {
      const ext = entry.name.split('.').pop().toLowerCase();
      const supportedExts = ['pdf', 'jpg', 'jpeg', 'png', 'html', 'txt', 'csv', 'docx', 'xlsx', 'md', 'json', 'xml'];

      if (!supportedExts.includes(ext)) {
        skippedFiles.push(entry.name);
        continue;
      }

      const blob = await entry.async('blob');
      const extractedFile = new File([blob], entry.name, {
        type: inferMimeType(entry.name)
      });

      extractedFiles.push(extractedFile);
    }

    onProgress({ stage: "completed", progress: 100 });

    return {
      isZipResult: true,
      zipName: file.name,
      extractedFiles,
      extractedCount: extractedFiles.length,
      skippedCount: skippedFiles.length,
      message: `${extractedFiles.length} files extracted from ZIP`
    };
  }
}

function inferMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv', html: 'text/html', txt: 'text/plain',
    md: 'text/markdown', json: 'application/json', xml: 'text/xml'
  };
  return map[ext] || 'application/octet-stream';
}

const queueManager = new QueueManager();
export default queueManager;