/**
 * Empty state — illustration-less, just message + optional action.
 */
import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-12) var(--space-4)',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    gap: 12,
  };

  return (
    <div style={containerStyle}>
      {icon && <div style={{ opacity: 0.4 }}>{icon}</div>}
      <p className="text-lg" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && <p className="text-sm" style={{ maxWidth: 360 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
