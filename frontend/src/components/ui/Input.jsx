import React, { forwardRef } from 'react';

/**
 * Reusable Input component with optional leading icon, trailing element (e.g., eye toggle),
 * floating label, and state feedback conforming to the DepEd QR Attendance design system.
 */
const Input = forwardRef(function Input(
  {
    label,
    id,
    type = 'text',
    value,
    onChange,
    placeholder,
    icon: Icon,
    rightElement,
    error,
    required = false,
    disabled = false,
    autoComplete,
    className = '',
    inputClassName = '',
    style = {},
    ...rest
  },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '-') : undefined);

  return (
    <div className={`sres-input-group ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="sres-input-label">
          {label}
          {required && <span className="sres-input-required" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className="sres-input-box-wrap">
        {Icon && (
          <div className="sres-input-icon-left" aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          className={`sres-input-field ${Icon ? 'with-left-icon' : ''} ${rightElement ? 'with-right-element' : ''} ${inputClassName}`}
          style={style}
          {...rest}
        />

        {rightElement && (
          <div className="sres-input-element-right">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <div className="sres-input-error-msg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

export default Input;
