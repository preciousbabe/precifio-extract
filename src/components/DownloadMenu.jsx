import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  FileText,
  File
} from 'lucide-react';

import {
  downloadAsCSV,
  downloadAsExcel,
  downloadAsJSON,
  downloadAsPDF
} from '../download';

export default function DownloadMenu({
  extraction,
  fileName = 'document'
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );
  }, []);

  const handleDownload = async (type) => {
    try {
      switch (type) {
        case 'csv':
          downloadCSV(extraction, fileName);
          break;

        case 'excel':
          await downloadExcel(extraction, fileName);
          break;

        case 'json':
          downloadJSON(extraction, fileName);
          break;

        case 'pdf':
          downloadPDF(extraction, fileName);
          break;

        default:
          break;
      }

      setOpen(false);
    } catch (err) {
      console.error(err);
      alert('Download failed.');
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'relative',
        display: 'inline-block'
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: '#fff',
          cursor: 'pointer',
          fontWeight: 600
        }}
      >
        <Download size={18} />
        Download
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: 240,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow:
              '0 8px 20px rgba(0,0,0,.08)',
            overflow: 'hidden',
            zIndex: 1000
          }}
        >
          <MenuItem
            icon={<FileSpreadsheet size={18} />}
            label="CSV"
            onClick={() =>
              handleDownload('csv')
            }
          />

          <MenuItem
            icon={<FileSpreadsheet size={18} />}
            label="Excel (.xlsx)"
            onClick={() =>
              handleDownload('excel')
            }
          />

          <MenuItem
            icon={<FileJson size={18} />}
            label="JSON"
            onClick={() =>
              handleDownload('json')
            }
          />

          <MenuItem
            icon={<FileText size={18} />}
            label="PDF Report"
            onClick={() =>
              handleDownload('pdf')
            }
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #f3f4f6'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background =
          '#f9fafb';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          '#fff';
      }}
    >
      {icon}

      <span
        style={{
          fontSize: 14
        }}
      >
        {label}
      </span>
    </div>
  );
}