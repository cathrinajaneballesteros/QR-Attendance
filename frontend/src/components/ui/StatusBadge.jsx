import React from 'react';

export default function StatusBadge({
  status,
  variant,
  label,
  children,
  icon: Icon,
  className = '',
  style = {}
}) {
  // Infer variant from status string if not explicitly passed
  let resolvedVariant = variant;
  if (!resolvedVariant && typeof status === 'string') {
    const s = status.toLowerCase();
    if (s.includes('present') || s.includes('enrolled') || s.includes('success') || s.includes('verified') || s === 'm') {
      resolvedVariant = s === 'm' ? 'lavender' : 'success';
    } else if (s.includes('absent') || s.includes('danger') || s.includes('blocked') || s.includes('fail') || s.includes('error')) {
      resolvedVariant = 'danger';
    } else if (s.includes('late') || s.includes('warning') || s.includes('pending') || s === 'f') {
      resolvedVariant = s === 'f' ? 'pink' : 'warning';
    } else {
      resolvedVariant = 'neutral';
    }
  }

  const text = label || children || status;

  return (
    <span className={`sres-status-badge sres-status-${resolvedVariant || 'neutral'} ${className}`} style={style}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      <span>{text}</span>
    </span>
  );
}
