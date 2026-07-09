// netlify/functions/processors/extract-xlsx.js
// Extracts text from XLSX and CSV files, converting to markdown table format.
// Preserves structure so GPT can understand tables.

const XLSX = require('xlsx');

async function extractXLSX(file) {
  try {
    const buffer = file.buffer || Buffer.from(file.content, 'base64');
    const mimeType = file.type || '';
    
    let workbook;
    
    if (mimeType === 'text/csv' || file.name.endsWith('.csv')) {
      // Parse CSV
      const csvText = buffer.toString('utf8');
      workbook = XLSX.read(csvText, { type: 'string' });
    } else {
      // Parse XLSX
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }
    
    let fullText = '';
    const sheetNames = workbook.SheetNames;
    
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON array
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) continue;
      
      fullText += `\n--- Sheet: ${sheetName} ---\n\n`;
      
      // Convert to markdown table for better GPT understanding
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!Array.isArray(row)) continue;
        
        // Clean row data
        const cleanRow = row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return String(cell).trim();
        });
        
        fullText += cleanRow.join(' | ') + '\n';
        
        // Add separator after header row
        if (i === 0) {
          fullText += cleanRow.map(() => '---').join(' | ') + '\n';
        }
      }
      
      fullText += '\n';
    }
    
    return {
      text: fullText.trim(),
      metadata: {
        method: mimeType.includes('csv') ? 'csv-parse' : 'xlsx-parse',
        sheets: sheetNames.length,
        sheetNames: sheetNames
      }
    };
  } catch (err) {
    console.error('XLSX/CSV extraction error:', err.message);
    throw new Error(`Failed to extract spreadsheet: ${err.message}`);
  }
}

module.exports = { extractXLSX };