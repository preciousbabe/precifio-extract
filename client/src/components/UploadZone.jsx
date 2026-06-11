import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, ChevronDown } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'invoice', label: 'Invoice', icon: '📄' },
  { value: 'receipt', label: 'Receipt', icon: '🧾' },
  { value: 'bank-statement', label: 'Bank Statement', icon: '🏦' },
  { value: 'contract', label: 'Contract', icon: '📋' },
  { value: 'utility-bill', label: 'Utility Bill', icon: '⚡' },
  { value: 'purchase-order', label: 'Purchase Order', icon: '📦' }
];

export function UploadZone({ onUpload }) {
  const [docType, setDocType] = useState('invoice');

  const onDrop = useCallback((files) => {
    if (files[0]) onUpload(files[0], docType);
  }, [onUpload, docType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });

  return (
    <div>
      {/* Document Type Selector */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <label style={{ fontSize: '14px', color: '#6b7280', marginRight: '8px' }}>
          Document Type:
        </label>
        <select 
          value={docType} 
          onChange={(e) => setDocType(e.target.value)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {DOCUMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.icon} {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? '#eff6ff' : '#f9fafb'
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <FileText size={48} color="#3b82f6" />
        ) : (
          <Upload size={48} color="#6b7280" />
        )}
        <p style={{ marginTop: '16px', fontSize: '16px' }}>
          {isDragActive ? 'Drop the document here' : `Drag & drop ${docType}, or click to browse`}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
          PDF, JPG, PNG, DOCX, XLSX up to 10MB
        </p>
      </div>
    </div>
  );
}