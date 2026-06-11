import { useState } from 'react';

const API_URL = '/api/extract';

export function useExtraction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const extract = async (file, documentType = 'invoice', authToken = null) => {
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('document', file);
    formData.append('documentType', documentType);
    
    const headers = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        headers
      });
      
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
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