// ============================================================
// VALIDATOR — Type-agnostic validation using document registry
// Uses shared validationUtils for field resolution
// ============================================================

import { getDocumentTypeInfo, isLegacyType } from '../schemas/documentRegistry.js';
import { 
  hasValue,
  resolveFieldValue,
  getFieldFromSections,
  buildSectionAliases,
  isValidDate,
  checkDateValidity,
  checkMathIntegrity,
  checkBalanceIntegrity,
  checkPlaceholders,
  isPlaceholder
} from './validationUtils.js';

// ============================================================
// MAIN ENTRY POINT
// ============================================================

export function validateExtraction(extracted) {
  const docType = extracted.document_type || 'unknown';
  const typeInfo = getDocumentTypeInfo(docType);
   // All documents use unified section-based validation
  return validateFlexibleFormat(extracted, typeInfo, docType);
}

// ============================================================
// FLEXIBLE FORMAT VALIDATION
// ============================================================

function validateFlexibleFormat(extracted, typeInfo, docType) {
  const informationalFlags = [];
  const warningFlags = [];

  // ── 1. STRUCTURAL VALIDATION ──────────────────────────────

  if (!Array.isArray(extracted.sections)) {
    warningFlags.push({
      type: 'WARNING',
      field: 'sections',
      message: 'sections is not an array — extraction may be malformed'
    });
  }

  if (!extracted.issuer || typeof extracted.issuer !== 'object') {
    informationalFlags.push({
      type: 'INFO',
      field: 'issuer',
      message: 'Issuer information not structured'
    });
  }

  if (!extracted.recipient || typeof extracted.recipient !== 'object') {
    informationalFlags.push({
      type: 'INFO',
      field: 'recipient',
      message: 'Recipient information not detected'
    });
  }

  // ── 2. CHECK REQUIRED SECTIONS ──

  const requiredSections = typeInfo.sections || [];
  const presentSections = (extracted.sections || []).map(s => s.section_type);

  // Use shared buildSectionAliases for consistency
  const sectionAliases = buildSectionAliases(typeInfo);
  const missingSections = requiredSections.filter(rs => {
    const aliases = sectionAliases[rs] || [rs];
    return !presentSections.some(ps => aliases.includes(ps));
  });

  if (missingSections.length > 0) {
    informationalFlags.push({
      type: 'INFO',
      field: 'sections',
      message: `Expected sections not found: ${missingSections.join(', ')}`
    });
  }

  // ── 3. CHECK REQUIRED FIELDS (using shared resolveFieldValue) ──

  const requiredFields = typeInfo.requiredFields || [];
  const missingRequired = [];

  for (const field of requiredFields) {
    // Use shared resolveFieldValue for consistency with confidenceEngine
    const value = resolveFieldValue(extracted, field, docType);

    if (!hasValue(value)) {
      missingRequired.push(field);
      informationalFlags.push({
        type: 'INFO',
        field,
        message: `${field.replace(/_/g, ' ')} not found — may be in sections or use different field name`
      });
    }
  }

  // ── 4. CHECK ISSUER / RECIPIENT ──

  const issuer = extracted.issuer || {};
  if (!hasValue(issuer.name) && !hasValue(extracted.vendor_name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'issuer.name',
      message: 'Issuer/company name not detected'
    });
  }

  const recipient = extracted.recipient || {};
  if (!hasValue(recipient.name) && !hasValue(extracted.buyer_name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'recipient.name',
      message: 'Recipient name not detected'
    });
  }

  // ── 5. CHECK DATES ──

  if (!hasValue(extracted.issue_date) && !hasValue(extracted.date)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'issue_date',
      message: 'Document date not found'
    });
  }

  // ── 6. CHECK FOR PLACEHOLDER VALUES (using shared utility) ──

  checkPlaceholders(extracted, warningFlags);

  // ── 7. CHECK DATE VALIDITY (using shared utility) ──

  const invalidDates = [];
  checkDateValidity(extracted, invalidDates);
  invalidDates.forEach(field => {
    warningFlags.push({
      type: 'WARNING',
      field,
      message: `Invalid date format for ${field}`
    });
  });

  // ── 8. MATH & BALANCE INTEGRITY (using shared utilities) ──

  if (checkMathIntegrity(extracted, docType)) {
    warningFlags.push({
      type: 'WARNING',
      field: 'math_integrity',
      message: 'Math integrity issue: subtotal + tax + shipping - discount does not equal total'
    });
  }

  if (checkBalanceIntegrity(extracted, docType)) {
    warningFlags.push({
      type: 'WARNING',
      field: 'balance_integrity',
      message: 'Balance mismatch: closing balance does not match last transaction balance'
    });
  }

  // ── 9. CATEGORY CHECK ──

  if (extracted.category === 'Uncategorized' && hasValue(issuer.name)) {
    informationalFlags.push({
      type: 'INFO',
      field: 'category',
      message: 'Category could not be determined from document content'
    });
  }

  // ── 10. COMPUTE RESULT (ALIGNED with confidenceEngine) ──

  const allFlags = [...informationalFlags, ...warningFlags];
  const hasCritical = allFlags.some(f => ['CRITICAL', 'ERROR'].includes(f.type));
  const hasSevereWarning = allFlags.some(f => f.type === 'WARNING');

  const hasAnyData = hasValue(issuer.name) || 
                     hasValue(recipient.name) || 
                     (extracted.sections || []).length > 0 || 
                     Object.keys(extracted.specific_fields || {}).length > 0;

  // ALIGNED with confidenceEngine logic:
  // requiresReview if missing required fields OR math/balance issues
  const requiresReview = hasCritical || 
                         hasSevereWarning ||
                         missingRequired.length > 0 ||
                         (!hasAnyData && docType !== 'unknown');

  return {
    isValid: !requiresReview,
    flags: allFlags,
    informationalFlags,
    warningFlags,
    requiresReview,
    severity: hasCritical ? 'CRITICAL' : hasSevereWarning ? 'WARNING' : 'INFO',
    missingRequired  // NEW: exposed for pipeline status
  };
}