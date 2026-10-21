import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, ArrowRight } from 'lucide-react';

export default function FeatureCard({
  title = 'Scan Student QR Code',
  description = 'Record attendance in seconds.',
  icon: Icon = QrCode,
  buttonText = 'Open QR Scanner',
  buttonIcon: ButtonIcon,
  buttonTo = '/attendance',
  onButtonClick,
  className = '',
  style = {}
}) {
  const content = (
    <div className={`sres-feature-card ${className}`} style={style}>
      {/* Outlined Icon in Glowing Rounded Square */}
      <div className="sres-feature-icon-square">
        <Icon size={42} strokeWidth={1.75} color="#ffffff" />
      </div>

      {/* Text Meta & Action Button */}
      <div className="sres-feature-body">
        <h2 className="sres-feature-title">{title}</h2>
        <p className="sres-feature-desc">{description}</p>

        {buttonTo ? (
          <Link to={buttonTo} className="sres-feature-btn">
            {ButtonIcon && <ButtonIcon size={16} strokeWidth={2} />}
            <span>{buttonText}</span>
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        ) : (
          <button type="button" onClick={onButtonClick} className="sres-feature-btn">
            {ButtonIcon && <ButtonIcon size={16} strokeWidth={2} />}
            <span>{buttonText}</span>
            <ArrowRight size={15} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );

  return content;
}
