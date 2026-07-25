/**
 * Toast container — renders from ui store.
 * Positioned bottom-right, auto-dismiss 5s.
 */
import React from 'react';
import { useUIStore } from '../../stores/ui';
import { CloseIcon } from '../icons';

const typeColors: Record<string, string> = {
  info: 'var(--bg-accent)',
  error: 'var(--bg-danger)',
  success: 'var(--bg-success)',
};

export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderLeft: `3px solid ${typeColors[toast.type]}`,
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          <span className="text-sm" style={{ flex: 1, color: 'var(--text-primary)' }}>
            {toast.message}
          </span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              display: 'flex',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 2,
            }}
            aria-label="Dismiss"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

ToastContainer.displayName = 'ToastContainer';
