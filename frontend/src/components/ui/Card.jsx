import React from 'react';

export default function Card({ 
  children, 
  className = '', 
  style = {}, 
  padding = '20px', 
  onClick 
}) {
  return (
    <div 
      className={`sres-card ${className}`} 
      style={{ padding, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
