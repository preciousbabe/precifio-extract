// src/components/DocumentUploader.jsx
// Drag & drop uploader with client-side ZIP extraction

import React, { useState, useCallback, useRef } from 'react';
import JSZip from 'jszip';

const SUPPORTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/tiff',
  'image/bmp',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/html',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml',
  'application/zip',
  'application/x-zip-compressed'
];

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_BATCH_SIZE = 100;

const SUPPORTED_EXTENSIONS = [
  'pdf', 'jpg', 'jpeg', 'png', 'tiff', 'bmp', 'webp',
  'docx', 'xlsx', 'csv', 'html', 'txt', 'md', 'json', 'xml'
];

export default function DocumentUploader({
  onAddFiles,
  isProcessing
}) {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState([]);
  const [zipExtracting, setZipExtracting] = useState(false);
  const inputRef = useRef(null);

  //--------------------------------------------------------
  // Helpers
  //--------------------------------------------------------

  const inferType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      tiff: 'image/tiff', bmp: 'image/bmp', webp: 'image/webp',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv', html: 'text/html', txt: 'text/plain',
      md: 'text/markdown', json: 'application/json', xml: 'text/xml',
      zip: 'application/zip'
    };
    return map[ext] || null;
  };

  const isZipFile = (file) => {
    return (
      file.type === 'application/zip' ||
      file.type === 'application/x-zip-compressed' ||
      file.name.toLowerCase().endsWith('.zip')
    );
  };

  const getFileType = (file) => {
    return file.type || inferType(file.name) || 'application/octet-stream';
  };

  //--------------------------------------------------------
  // ZIP Extraction
  //--------------------------------------------------------

  const extractZip = async (zipFile) => {
    setZipExtracting(true);
    const extracted = [];
    const skipped = [];

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const entries = Object.values(zip.files).filter(entry => !entry.dir);

      for (const entry of entries) {
        const ext = entry.name.split('.').pop().toLowerCase();

        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
          skipped.push(entry.name);
          continue;
        }

        const blob = await entry.async('blob');
        const file = new File([blob], entry.name, {
          type: inferType(entry.name) || 'application/octet-stream'
        });

        extracted.push(file);
      }

    } catch (err) {
      setErrors([`Failed to extract ZIP: ${err.message}`]);
    } finally {
      setZipExtracting(false);
    }

    return { extracted, skipped };
  };

  //--------------------------------------------------------
  // Validation
  //--------------------------------------------------------

  const validateFile = (file) => {
    const errs = [];
    const type = getFileType(file);

    if (file.size > MAX_FILE_SIZE) {
      errs.push(`${file.name}: exceeds 25MB limit`);
    }

    if (file.size === 0) {
      errs.push(`${file.name}: file is empty`);
    }

    const isSupported = SUPPORTED_TYPES.includes(type) || inferType(file.name);
    if (!isSupported) {
      errs.push(`${file.name}: unsupported file type`);
    }

    return errs;
  };

  //--------------------------------------------------------
  // File selection
  //--------------------------------------------------------

  const handleFiles = useCallback(async (incomingFiles) => {
    const fileArray = Array.from(incomingFiles);
    setErrors([]);

    if (!fileArray.length) return;

    if (fileArray.length > MAX_BATCH_SIZE) {
      setErrors([`Maximum ${MAX_BATCH_SIZE} files per batch`]);
      return;
    }

    const zipFiles = fileArray.filter(isZipFile);

    // Don't allow multiple ZIPs
    if (zipFiles.length > 1) {
      setErrors(['Please upload one ZIP archive at a time.']);
      return;
    }

    // Don't mix ZIP with other files
    if (zipFiles.length === 1 && fileArray.length > 1) {
      setErrors(['ZIP archives cannot be uploaded together with other files.']);
      return;
    }

    // If single ZIP, extract it
    if (zipFiles.length === 1) {
      const { extracted, skipped } = await extractZip(zipFiles[0]);

      if (skipped.length > 0) {
        setErrors(skipped.map(name => `${name}: skipped (unsupported type)`));
      }

      if (extracted.length === 0) {
        setErrors(prev => [...prev, 'No valid files found in ZIP']);
        return;
      }

      // Add extracted files directly
      const allErrors = [];
      const validFiles = extracted.filter(file => {
        const errs = validateFile(file);
        if (errs.length) allErrors.push(...errs);
        return errs.length === 0;
      });

      setErrors(allErrors);
      setFiles(prev => [...prev, ...validFiles]);
      return;
    }

    // Normal files — validate and add
    const allErrors = [];
    const validFiles = fileArray.filter(file => {
      const errs = validateFile(file);
      if (errs.length) allErrors.push(...errs);
      return errs.length === 0;
    });

    setErrors(allErrors);
    setFiles(prev => [...prev, ...validFiles]);

  }, []);

  //--------------------------------------------------------
  // Drag events
  //--------------------------------------------------------

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  //--------------------------------------------------------
  // Remove
  //--------------------------------------------------------

  const removeFile = useCallback((index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAllFiles = useCallback(() => {
    setFiles([]);
    setErrors([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  //--------------------------------------------------------
  // Submit
  //--------------------------------------------------------

  const handleSubmit = useCallback(() => {
    if (!files.length || isProcessing) return;

    onAddFiles(files);
    setFiles([]);
    setErrors([]);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [files, isProcessing, onAddFiles]);

  //--------------------------------------------------------
  // UI
  //--------------------------------------------------------

  const acceptTypes = [
    '.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp',
    '.docx', '.xlsx', '.csv', '.html', '.txt', '.md', '.json', '.xml', '.zip'
  ].join(',');

  return (
    <div className="uploader-container">
      {/* Drop Zone */}
      <div
        className={`drop-zone ${dragActive ? 'active' : ''} ${isProcessing || zipExtracting ? 'disabled' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id="file-input"
          type="file"
          multiple
          disabled={isProcessing || zipExtracting}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          accept={acceptTypes}
        />

        <label htmlFor="file-input">
          <div className="drop-icon">
            {zipExtracting ? '⏳' : '📄'}
          </div>
          <p className="drop-title">
            {zipExtracting
              ? 'Extracting ZIP contents...'
              : dragActive
                ? 'Drop files here'
                : 'Drop files here or click to browse'
            }
          </p>
          <span className="subtext">
            Supports PDF, Images, Office, CSV, TXT, JSON, XML, ZIP
            <br />
            <strong>Max 25MB per file · Up to {MAX_BATCH_SIZE} files</strong>
            {zipExtracting && <br />}
            {zipExtracting && <em>Please wait while we extract your ZIP...</em>}
          </span>
        </label>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="error-list">
          {errors.map((err, i) => (
            <div key={i} className="error-item">
              ⚠️ {err}
            </div>
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="file-list">
          <div className="file-list-header">
            <h4>
              {files.length} file{files.length > 1 ? 's' : ''} ready to queue
            </h4>
            <button
              className="clear-btn"
              onClick={clearAllFiles}
              disabled={isProcessing || zipExtracting}
            >
              Clear All
            </button>
          </div>

          <div className="file-items">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="file-item">
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-meta">
                    {(file.size / 1024).toFixed(1)} KB · {getFileType(file).split('/').pop()}
                  </span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeFile(i)}
                  disabled={isProcessing || zipExtracting}
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            className="extract-btn"
            disabled={isProcessing || zipExtracting || files.length === 0}
            onClick={handleSubmit}
          >
            {zipExtracting ? 'Extracting...' : isProcessing ? 'Processing...' : 'Add to Queue'}
          </button>
        </div>
      )}
    </div>
  );
}