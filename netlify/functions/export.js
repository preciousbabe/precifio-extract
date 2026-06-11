import { supabase } from '../../../server/src/config/supabase.js';
import { exportToCSV, exportToQuickBooks, exportToXero, saveExportRecord } from '../../../server/src/services/exports.js';

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse extractionId from path: /api/export/123e4567...
  const pathParts = event.path.split('/');
  const extractionId = pathParts[pathParts.length - 1];

  const { format } = JSON.parse(event.body || '{}');

  try {
    const { data: extraction, error } = await supabase
      .from('extractions')
      .select('*')
      .eq('id', extractionId)
      .single();

    if (error || !extraction) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Extraction not found' }) };
    }

    let exportData;
    let contentType;
    let filename;

    switch (format) {
      case 'csv':
        exportData = await exportToCSV(extraction.extracted_data);
        contentType = 'text/csv';
        filename = `precifio-${extraction.extracted_data.invoice_number || 'export'}.csv`;
        break;

      case 'quickbooks':
        exportData = JSON.stringify(await exportToQuickBooks(extraction.extracted_data), null, 2);
        contentType = 'application/json';
        filename = `precifio-qb-${extraction.extracted_data.invoice_number || 'export'}.json`;
        break;

      case 'xero':
        exportData = JSON.stringify(await exportToXero(extraction.extracted_data), null, 2);
        contentType = 'application/json';
        filename = `precifio-xero-${extraction.extracted_data.invoice_number || 'export'}.json`;
        break;

      default:
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unsupported export format' }) };
    }

    await saveExportRecord(extractionId, format, exportData);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      body: exportData,
      isBase64Encoded: false
    };

  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
}