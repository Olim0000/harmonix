/**
 * Button component — variants: primary, secondary, danger, ghost, icon.
 * Sizes: sm, md, lg.
 */
import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    backgroundColor: 'var(--bg-accent)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-primary)',
  },
  danger: {
    backgroundColor: 'var(--bg-danger)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
  icon: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    width: 32,
    height: 32,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { height: 32, fontSize: 12, padding: '0 12px' },
  md: { height: 40, fontSize: 14, padding: '0 16px' },
  lg: { height: 48, fontSize: 16, padding: '0 24px' },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...rest
}) => {
  const combinedStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `background-color var(--duration-fast) var(--easing-default)`,
    whiteSpace: 'nowrap',
    ...variantStyles[variant],
    ...(variant !== 'icon' ? sizeStyles[size] : variantStyles.icon),
    ...style,
  };

  return (
    <button
      style={combinedStyle}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  );
};

Button.displayName = 'Button';
