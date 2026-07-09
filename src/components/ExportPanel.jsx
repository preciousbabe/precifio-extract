// ExportPanel.jsx
// Export extracted data to PDF, CSV, XLSX, or JSON. Works with ANY segment structure.

import React, { useState } from 'react';
import { generatePDF, generateCSV, generateXLSX, generateJSON } from '../utils/exportFormats';

export default function ExportPanel({ data, fileName, mode = 'single' }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      switch (format) {
        case 'json':
          generateJSON(data, fileName);
          break;
        case 'csv':
          generateCSV(data, fileName, mode);
          break;
        case 'xlsx':
          await generateXLSX(data, fileName, mode);
          break;
        case 'pdf':
          await generatePDF(data, fileName, mode);
          break;
        default:
          break;
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <span className="export-label">Export:</span>
      {['json', 'csv', 'xlsx', 'pdf'].map(fmt => (
        <button 
          key={fmt}
          className="export-btn"
          onClick={() => handleExport(fmt)}
          disabled={exporting}
        >
          {fmt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}