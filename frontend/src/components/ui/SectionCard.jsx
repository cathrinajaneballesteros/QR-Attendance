import React from 'react';
import Card from './Card';

export default function SectionCard({ 
  title, 
  subtitle, 
  icon: Icon, 
  badge, 
  action, 
  children, 
  className = '', 
  style = {},
  headerStyle = {},
  padding = '22px'
}) {
  return (
    <Card className={`sres-section-card ${className}`} style={style} padding={padding}>
      {(title || subtitle || Icon || badge || action) && (
        <div className="sres-section-card-header" style={headerStyle}>
          <div className="sres-section-card-heading">
            {Icon && (
              <div className="sres-section-card-icon">
                <Icon size={19} strokeWidth={1.8} color="#6B0F3A" />
              </div>
            )}
            <div>
              <h2 className="sres-section-card-title">{title}</h2>
              {subtitle && <p className="sres-section-card-subtitle">{subtitle}</p>}
            </div>
          </div>

          <div className="sres-section-card-actions">
            {badge}
            {action}
          </div>
        </div>
      )}

      <div className="sres-section-card-body">
        {children}
      </div>
    </Card>
  );
}
