import { useState } from 'react';

const EXTRACT_URL = '/.netlify/functions/extract';
const BATCH_URL = '/.netlify/functions/batch-extract';

export function useExtraction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const extract = async (file, documentType = 'invoice', authToken = null) => {
  setLoading(true);
  setError(null);

  const isZip =
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.name?.endsWith('.zip');

  const endpoint = isZip ? BATCH_URL : EXTRACT_URL;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers
    });

    const data = await res.json();
    if (!data.success && data.error) throw new Error(data.error);

    setResult(data);
    return data;

  } catch (err) {
    setError(err.message);
    return null;

  } finally {
    setLoading(false);
  }
};

  const reset = () => {
    setResult(null);
    setError(null);
    setLoading(false);
  };

  return { extract, loading, result, error, reset };
}