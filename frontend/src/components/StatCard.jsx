import React from 'react';

export default function StatCard({ label, value, icon, color = 'var(--primary)' }) {
  return (
    <div className="stat-card">
      {icon && (
        <div className="stat-icon" style={{ color, background: `${color}15` }}>
          {icon}
        </div>
      )}
      <div>
        <div className="stat-value" style={{ color: '#0f172a' }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
