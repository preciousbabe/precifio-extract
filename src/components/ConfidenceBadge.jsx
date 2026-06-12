import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function ConfidenceBadge({ score, field }) {
  let color, icon, label;
  
  if (score >= 0.95) {
    color = '#22c55e';
    icon = <CheckCircle size={16} />;
    label = 'High';
  } else if (score >= 0.85) {
    color = '#eab308';
    icon = <AlertTriangle size={16} />;
    label = 'Medium';
  } else {
    color = '#ef4444';
    icon = <XCircle size={16} />;
    label = 'Review';
  }

  return (
    <span style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: '4px',
      color,
      fontSize: '12px',
      fontWeight: 500
    }}>
      {icon} {label} ({Math.round(score * 100)}%)
    </span>
  );
}