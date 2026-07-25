/**
 * Spinner — loading indicator (CSS animation).
 */
import React from 'react';

interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 20,
  color = 'var(--text-secondary)',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    style={{ animation: 'spin 0.8s linear infinite' }}
  >
    <circle
      cx="10"
      cy="10"
      r="8"
      stroke={color}
      strokeWidth="2"
      strokeDasharray="40"
      strokeDashoffset="30"
      strokeLinecap="round"
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

Spinner.displayName = 'Spinner';
