import { supabase } from '../config/supabase.js';
import { rewardCorrection } from './creditEngine.js';

export async function learnFromCorrection(userId, extractionId, fieldName, originalValue, correctedValue) {
  // Save correction
  await supabase.from('corrections').insert({
    extraction_id: extractionId,
    field_name: fieldName,
    original_value: String(originalValue),
    corrected_value: String(correctedValue)
  });
  
  // Reward user
  const reward = await rewardCorrection(userId, extractionId, fieldName);
  
  // Update vendor pattern
  if (fieldName === 'vendor_name' || fieldName === 'category') {
    const { data: extraction } = await supabase
      .from('extractions')
      .select('extracted_data')
      .eq('id', extractionId)
      .single();
    
    const vendorName = fieldName === 'vendor_name' 
      ? correctedValue 
      : extraction?.extracted_data?.vendor_name;
    
    if (vendorName) {
      await updateVendorPattern(userId, vendorName, {
        category: fieldName === 'category' ? correctedValue : undefined,
        source: 'correction'
      });
    }
  }
  
  return { success: true, reward };
}

export async function updateVendorPattern(userId, vendorName, updates) {
  const normalized = vendorName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  const { data: existing } = await supabase
    .from('vendor_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('normalized_name', normalized)
    .single();

  if (existing) {
    const newCount = existing.invoice_count + 1;
    const newAvg = existing.average_invoice_amount 
      ? ((existing.average_invoice_amount * existing.invoice_count) + (updates.amount || 0)) / newCount
      : updates.amount || 0;

    await supabase
      .from('vendor_patterns')
      .update({
        ...updates,
        invoice_count: newCount,
        average_invoice_amount: newAvg || existing.average_invoice_amount,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('vendor_patterns').insert({
      user_id: userId,
      vendor_name: vendorName,
      normalized_name: normalized,
      category: updates.category || 'Uncategorized',
      invoice_count: 1,
      average_invoice_amount: updates.amount || 0,
      last_seen_at: new Date().toISOString()
    });
  }
}

export async function applyVendorPatterns(userId, extraction) {
  if (!extraction.vendor_name) return extraction;
  
  const normalized = extraction.vendor_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  
  const { data: pattern } = await supabase
    .from('vendor_patterns')
    .select('*')
    .eq('user_id', userId)
    .eq('normalized_name', normalized)
    .single();

  if (!pattern) return extraction;

  return {
    ...extraction,
    category: extraction.category === 'Uncategorized' ? pattern.category : extraction.category,
    vendor_name: extraction.vendor_name || pattern.vendor_name,
    confidence_scores: {
      ...extraction.confidence_scores,
      vendor_name: 0.98
    }
  };
}

export async function detectAnomalies(userId, extraction, documentId) {
  const alerts = [];
  
  // Amount spike check
  if (extraction.vendor_name && extraction.total_amount) {
    const normalized = extraction.vendor_name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const { data: pattern } = await supabase
      .from('vendor_patterns')
      .select('average_invoice_amount, invoice_count')
      .eq('user_id', userId)
      .eq('normalized_name', normalized)
      .single();
    
    if (pattern?.average_invoice_amount && pattern.invoice_count > 2) {
      const threshold = pattern.average_invoice_amount * 2.5;
      if (extraction.total_amount > threshold) {
        alerts.push({
          user_id: userId,
          document_id: documentId,
          alert_type: 'amount_spike',
          severity: 'warning',
          description: `${extraction.vendor_name}: ${Math.round(extraction.total_amount / pattern.average_invoice_amount)}x average ($${pattern.average_invoice_amount})`
        });
      }
    }
  }

  // Duplicate check
  if (extraction.invoice_number) {
    const { data: duplicates } = await supabase
      .from('extractions')
      .select('id, documents!inner(id, user_id)')
      .eq('extracted_data->>invoice_number', extraction.invoice_number)
      .eq('documents.user_id', userId)
      .limit(2);
    
    if (duplicates?.length > 1) {
      alerts.push({
        user_id: userId,
        document_id: documentId,
        alert_type: 'duplicate_invoice',
        severity: 'critical',
        description: `Duplicate: ${extraction.invoice_number}`
      });
    }
  }

  // Missing fields
  if (!extraction.vendor_name || !extraction.total_amount) {
    alerts.push({
      user_id: userId,
      document_id: documentId,
      alert_type: 'missing_field',
      severity: 'warning',
      description: 'Missing vendor or total'
    });
  }

  if (alerts.length > 0) {
    await supabase.from('anomaly_alerts').insert(alerts);
  }

  return alerts;
}