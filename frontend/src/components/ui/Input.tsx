/**
 * Input component — text, password, search variants.
 * Height 40px, radius-sm, bg-secondary, border-primary.
 * Focus: border-accent, ring-accent.
 * Error state: border-danger + error message below.
 */
import React, { useState, forwardRef } from 'react';
import { SearchIcon, CloseIcon } from '../icons';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'text' | 'password' | 'search';
  error?: string;
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  variant = 'text',
  error,
  style,
  onClear,
  ...rest
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = variant === 'password';

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 40,
    padding: '0 12px',
    paddingLeft: variant === 'search' ? 36 : 12,
    paddingRight: isPassword ? 36 : variant === 'search' && onClear ? 36 : 12,
    backgroundColor: 'var(--bg-secondary)',
    border: `1px solid ${error ? 'var(--bg-danger)' : 'var(--border-primary)'}`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
    transition: `border-color var(--duration-fast) var(--easing-default)`,
    ...style,
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: 10,
    color: 'var(--text-tertiary)',
    pointerEvents: 'none',
    display: 'flex',
  };

  const rightIconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    right: 10,
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    display: 'flex',
    background: 'none',
    border: 'none',
    padding: 4,
  };

  return (
    <div style={containerStyle}>
      {variant === 'search' && (
        <span style={iconStyle}>
          <SearchIcon size={16} />
        </span>
      )}
      <input
        ref={ref}
        type={isPassword && !showPassword ? 'password' : 'text'}
        style={inputStyle}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-accent)';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.3)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? 'var(--bg-danger)'
            : 'var(--border-primary)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...rest}
      />
      {isPassword && (
        <button
          type="button"
          style={rightIconStyle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            {showPassword ? (
              <>
                <path d="M1 10s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z" />
                <circle cx="10" cy="10" r="2" />
              </>
            ) : (
              <>
                <path d="M2 2l16 16" />
                <path d="M8.5 8.5a3 3 0 004.2 4.2" />
                <path d="M14.1 5.9A9 9 0 0119 10c-1 2-3 5-7 5.8" />
                <path d="M5.9 14.1A9 9 0 011 10c1-2 3-5 7-5.8" />
              </>
            )}
          </svg>
        </button>
      )}
      {(variant === 'search' && onClear && rest.value) && (
        <button
          type="button"
          style={rightIconStyle}
          onClick={onClear}
          aria-label="Clear search"
        >
          <CloseIcon size={14} />
        </button>
      )}
      {error && (
        <p
          style={{
            color: 'var(--bg-danger)',
            fontSize: 12,
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
