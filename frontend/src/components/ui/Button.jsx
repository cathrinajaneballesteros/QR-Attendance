import React from 'react';
import { Link } from 'react-router-dom';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'white' | 'secondary' | 'outline' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  iconRight: IconRight,
  to,
  type = 'button',
  disabled = false,
  onClick,
  className = '',
  style = {}
}) {
  const classNames = `sres-btn sres-btn-${variant} sres-btn-${size} ${className}`;

  if (to && !disabled) {
    return (
      <Link to={to} className={classNames} style={style}>
        {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} />}
        <span>{children}</span>
        {IconRight && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2} />}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classNames}
      style={style}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} />}
      <span>{children}</span>
      {IconRight && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2} />}
    </button>
  );
}
