import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';

const DOCUMENT_TYPES = [
  // Financial
  { value: 'invoice', label: 'Invoice', icon: '📄', category: 'financial' },
  { value: 'receipt', label: 'Receipt', icon: '🧾', category: 'financial' },
  { value: 'bank-statement', label: 'Bank Statement', icon: '🏦', category: 'financial' },
  { value: 'credit-card-statement', label: 'Credit Card Statement', icon: '💳', category: 'financial' },
  { value: 'purchase-order', label: 'Purchase Order', icon: '📦', category: 'financial' },
  { value: 'expense-report', label: 'Expense Report', icon: '💵', category: 'financial' },
  { value: 'tax-form', label: 'Tax Form', icon: '📑', category: 'financial' },
  { value: 'payroll-report', label: 'Payroll Report', icon: '💰', category: 'financial' },
  { value: 'utility-bill', label: 'Utility Bill', icon: '⚡', category: 'financial' },

  // Legal
  { value: 'contract', label: 'Contract', icon: '📋', category: 'legal' },
  { value: 'lease-agreement', label: 'Lease Agreement', icon: '🏠', category: 'legal' },
  { value: 'nda', label: 'NDA', icon: '🔒', category: 'legal' },
  { value: 'service-agreement', label: 'Service Agreement', icon: '🤝', category: 'legal' },
  { value: 'court-document', label: 'Court Document', icon: '⚖️', category: 'legal' },
  { value: 'property-deed', label: 'Property Deed', icon: '🏡', category: 'legal' },

  // Insurance
  { value: 'insurance-claim', label: 'Insurance Claim', icon: '🛡️', category: 'insurance' },

  // HR
  { value: 'resume', label: 'Resume / CV', icon: '📄', category: 'hr' },
  { value: 'employment-contract', label: 'Employment Contract', icon: '📝', category: 'hr' },
  { value: 'offer-letter', label: 'Offer Letter', icon: '✉️', category: 'hr' },
  { value: 'employee-record', label: 'Employee Record', icon: '👤', category: 'hr' },
  { value: 'performance-review', label: 'Performance Review', icon: '📊', category: 'hr' },

  // Healthcare
  { value: 'medical-report', label: 'Medical Report', icon: '🩺', category: 'healthcare' },
  { value: 'lab-result', label: 'Lab Result', icon: '🔬', category: 'healthcare' },
  { value: 'prescription', label: 'Prescription', icon: '💊', category: 'healthcare' },
  { value: 'patient-intake', label: 'Patient Intake', icon: '📋', category: 'healthcare' },

  // Logistics
  { value: 'bill-of-lading', label: 'Bill of Lading', icon: '📦', category: 'logistics' },
  { value: 'shipping-manifest', label: 'Shipping Manifest', icon: '🚢', category: 'logistics' },
  { value: 'delivery-note', label: 'Delivery Note', icon: '📮', category: 'logistics' },
  { value: 'customs-document', label: 'Customs Document', icon: '🛃', category: 'logistics' },

  // Real Estate
  { value: 'property-valuation', label: 'Property Valuation', icon: '💰', category: 'real_estate' },
  { value: 'inspection-report', label: 'Inspection Report', icon: '🔍', category: 'real_estate' },
  { value: 'mortgage-document', label: 'Mortgage Document', icon: '🏦', category: 'real_estate' },
  { value: 'land-registry', label: 'Land Registry', icon: '🗺️', category: 'real_estate' },

  // Education
  { value: 'transcript', label: 'Academic Transcript', icon: '🎓', category: 'education' },
  { value: 'certificate', label: 'Certificate', icon: '🏆', category: 'education' },
  { value: 'diploma', label: 'Diploma', icon: '🎓', category: 'education' },
  { value: 'student-record', label: 'Student Record', icon: '📚', category: 'education' },

  // Government
  { value: 'passport', label: 'Passport', icon: '🛂', category: 'government' },
  { value: 'drivers-license', label: "Driver's License", icon: '🚗', category: 'government' },
  { value: 'national-id', label: 'National ID', icon: '🆔', category: 'government' },
  { value: 'permit', label: 'Permit', icon: '📜', category: 'government' },
  { value: 'license', label: 'License', icon: '📋', category: 'government' }
];

export function UploadZone({ onUpload }) {
  const [docType, setDocType] = useState('mixed');

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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxFiles: 1
  });

  const groupedTypes = DOCUMENT_TYPES.reduce((acc, type) => {
    if (!acc[type.category]) acc[type.category] = [];
    acc[type.category].push(type);
    return acc;
  }, {});

  const categoryLabels = {
    financial: 'Financial',
    legal: 'Legal',
    insurance: 'Insurance',
    hr: 'HR',
    healthcare: 'Healthcare',
    logistics: 'Logistics',
    real_estate: 'Real Estate',
    education: 'Education',
    government: 'Government ID'
  };

  return (
    <div>
      {/* Document Type Selector */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <label style={{ fontSize: '14px', color: '#6b7280', marginRight: '8px', display: 'block', marginBottom: '8px' }}>
          Document Type:
        </label>
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '280px',
            maxWidth: '100%'
          }}
        >
          <option value="mixed">🔍 Auto-Detect (Recommended)</option>
          {Object.entries(groupedTypes).map(([category, types]) => (
            <optgroup key={category} label={categoryLabels[category] || category}>
              {types.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
          Select "Auto-Detect" to let AI identify the document type automatically
        </p>
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
          {isDragActive ? 'Drop the document here' : 'Drag & drop your document, or click to browse'}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
          PDF, JPG, PNG, DOCX, XLSX up to 10MB
        </p>
      </div>
    </div>
  );
}