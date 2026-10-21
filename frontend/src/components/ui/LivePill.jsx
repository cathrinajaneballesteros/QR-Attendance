import React from 'react';

export default function LivePill({ 
  label = 'Live', 
  className = '', 
  style = {} 
}) {
  return (
    <span className={`sres-live-pill ${className}`} style={style}>
      <span className="sres-live-dot" />
      <span>{label}</span>
    </span>
  );
}
