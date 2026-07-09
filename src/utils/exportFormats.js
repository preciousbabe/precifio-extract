// exportFormats.js
// Generates export files from dynamic segment data. No document-type logic.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Flatten segments into rows for tabular export
function flattenSegments(segments) {
  const rows = [];
  segments.forEach(seg => {
    seg.fields.forEach(field => {
      rows.push({
        segment: seg.segment_name,
        label: field.label,
        value: field.value,
        confidence: field.confidence
      });
    });
  });
  return rows;
}

export function generateJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${fileName}.json`);
}

export function generateCSV(data, fileName, mode = 'single') {
  let rows = [];
  
  if (mode === 'batch') {
    data.results.forEach(res => {
      flattenSegments(res.segments).forEach(row => {
        rows.push({ file: res.fileName, ...row });
      });
    });
  } else {
    rows = flattenSegments(data.segments);
  }

  const headers = mode === 'batch' 
    ? ['File', 'Segment', 'Label', 'Value', 'Confidence']
    : ['Segment', 'Label', 'Value', 'Confidence'];
  
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      ...(mode === 'batch' ? [escapeCsv(r.file)] : []),
      escapeCsv(r.segment),
      escapeCsv(r.label),
      escapeCsv(r.value),
      r.confidence
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `${fileName}.csv`);
}

export async function generateXLSX(data, fileName, mode = 'single') {
  const wb = XLSX.utils.book_new();

  if (mode === 'batch') {
    data.results.forEach(res => {
      const rows = flattenSegments(res.segments);
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, res.fileName.substring(0, 31));
    });
  } else {
    const rows = flattenSegments(data.segments);
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Extraction');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${fileName}.xlsx`);
}

export async function generatePDF(data, fileName, mode = 'single') {
  const doc = new jsPDF();
  
  if (mode === 'batch') {
    data.results.forEach((res, idx) => {
      if (idx > 0) doc.addPage();
      renderDocumentToPDF(doc, res);
    });
  } else {
    renderDocumentToPDF(doc, data);
  }

  doc.save(`${fileName}.pdf`);
}

function renderDocumentToPDF(doc, result) {
  let y = 20;
  
  // Header
  doc.setFontSize(18);
  doc.text(result.fileName, 14, y);
  y += 10;
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(result.documentSummary || '', 14, y);
  y += 15;

  // Segments as tables
  result.segments?.forEach(segment => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(segment.segment_name, 14, y);
    y += 8;

    const tableData = segment.fields.map(f => [f.label, String(f.value), `${Math.round((f.confidence || 0.5) * 100)}%`]);
    
    autoTable(doc, {
      startY: y,
      head: [['Field', 'Value', 'Confidence']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'center' }
      }
    });

    y = doc.lastAutoTable.finalY + 15;
  });
}

function escapeCsv(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}