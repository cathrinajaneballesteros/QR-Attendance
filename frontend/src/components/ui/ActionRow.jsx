import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function ActionRow({
  title,
  description,
  icon: Icon,
  iconColor = '#6B0F3A',
  iconBg = '#FDF2F6',
  to,
  onClick,
  className = '',
  style = {}
}) {
  const rowContent = (
    <div className={`sres-action-row ${className}`} style={style} onClick={onClick}>
      {/* Tinted Square Icon */}
      {Icon && (
        <div 
          className="sres-action-icon-square"
          style={{
            color: iconColor,
            background: iconBg
          }}
        >
          {React.isValidElement(Icon) ? Icon : <Icon size={19} strokeWidth={1.8} />}
        </div>
      )}

      {/* Title & Gray Description */}
      <div className="sres-action-meta">
        <span className="sres-action-title">{title}</span>
        {description && <span className="sres-action-desc">{description}</span>}
      </div>

      {/* Chevron Arrow */}
      <div className="sres-action-chevron">
        <ChevronRight size={16} strokeWidth={2} color="#94A3B8" />
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>
        {rowContent}
      </Link>
    );
  }

  return rowContent;
}
