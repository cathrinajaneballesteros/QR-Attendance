import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Scan } from 'lucide-react';

export default function EmptyState({
  title = 'No attendance records yet',
  hint = 'Start by scanning a student QR code to record attendance for your class.',
  buttonText = 'Start by scanning a student QR code',
  buttonIcon: ButtonIcon = Scan,
  buttonTo = '/attendance',
  onButtonClick,
  className = '',
  style = {}
}) {
  return (
    <div className={`sres-empty-state ${className}`} style={style}>
      {/* Centered Pink Illustration */}
      <div className="sres-empty-illustration">
        <svg viewBox="0 0 120 120" width="100" height="100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Soft Pink Background Glow */}
          <circle cx="60" cy="60" r="50" fill="#FDF2F6" />
          <circle cx="60" cy="60" r="38" fill="#FCE7F3" />
          
          {/* Clipboard / ID Card Frame */}
          <rect x="36" y="28" width="48" height="64" rx="8" fill="#FFFFFF" stroke="#F472B6" strokeWidth="2" />
          
          {/* Clipboard Clip */}
          <rect x="48" y="24" width="24" height="8" rx="3" fill="#C2185B" />
          <circle cx="60" cy="28" r="2" fill="#FFFFFF" />
          
          {/* Student Avatar Silhouette */}
          <circle cx="60" cy="46" r="8" fill="#FCE7F3" stroke="#EC4899" strokeWidth="1.5" />
          <path d="M48 62C48 56.4772 53.3726 53 60 53C66.6274 53 72 56.4772 72 62" stroke="#EC4899" strokeWidth="1.5" strokeLinecap="round" />
          
          {/* Mini QR Badge Floating on Bottom Right */}
          <rect x="62" y="60" width="28" height="28" rx="6" fill="#6B0F3A" />
          <rect x="67" y="65" width="6" height="6" fill="#FFFFFF" />
          <rect x="77" y="65" width="6" height="6" fill="#FFFFFF" />
          <rect x="67" y="75" width="6" height="6" fill="#FFFFFF" />
          <rect x="77" y="75" width="6" height="6" fill="#FFFFFF" />
          <rect x="73" y="71" width="4" height="4" fill="#FFFFFF" />
        </svg>
      </div>

      {/* Bold Message */}
      <h3 className="sres-empty-title">{title}</h3>

      {/* Gray Hint */}
      {hint && <p className="sres-empty-hint">{hint}</p>}

      {/* Gradient Action Button */}
      {buttonText && (
        buttonTo ? (
          <Link to={buttonTo} className="sres-btn sres-btn-primary sres-empty-btn">
            {ButtonIcon && <ButtonIcon size={16} strokeWidth={2} />}
            <span>{buttonText}</span>
          </Link>
        ) : (
          <button type="button" onClick={onButtonClick} className="sres-btn sres-btn-primary sres-empty-btn">
            {ButtonIcon && <ButtonIcon size={16} strokeWidth={2} />}
            <span>{buttonText}</span>
          </button>
        )
      )}
    </div>
  );
}
