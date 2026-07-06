/**
 * ============================================================
 * Precifio Extract
 * Download Filename Generator
 * ============================================================
 */

function sanitize(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 60);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export function generateFileName(extraction, extension) {
  const type =
    sanitize(extraction.document_type) ||
    'document';

  const identifier =
    sanitize(
      extraction.invoice_number ||
      extraction.receipt_number ||
      extraction.contract_number ||
      extraction.claim_number ||
      extraction.policy_number ||
      extraction.passport_number ||
      extraction.license_number ||
      extraction.account_number ||
      extraction.document_id ||
      extraction.reference_number ||
      extraction.vendor_name ||
      extraction.recipient?.name ||
      extraction.issuer?.name ||
      today()
    );

  return `${type}_${identifier}.${extension}`;
}