import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Card from './Card';

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = '#6B0F3A',
  bgTint = '#FDF2F6',
  to,
  onClick,
  showChevron = true,
  className = '',
  style = {}
}) {
  const cardContent = (
    <Card 
      className={`sres-stat-card ${to || onClick ? 'sres-stat-card-clickable' : ''} ${className}`}
      style={style}
      padding="18px 20px"
      onClick={onClick}
    >
      {/* Round Tinted Icon */}
      {Icon && (
        <div 
          className="sres-stat-icon-circle"
          style={{ 
            color: color, 
            background: bgTint 
          }}
        >
          {React.isValidElement(Icon) ? Icon : <Icon size={20} strokeWidth={1.8} />}
        </div>
      )}

      {/* Number and Label */}
      <div className="sres-stat-meta">
        <span className="sres-stat-value">{value}</span>
        <span className="sres-stat-label">{label}</span>
      </div>

      {/* Chevron Right */}
      {showChevron && (
        <div className="sres-stat-chevron">
          <ChevronRight size={16} strokeWidth={2} color="#94A3B8" />
        </div>
      )}
    </Card>
  );

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: 'none', display: 'block' }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
