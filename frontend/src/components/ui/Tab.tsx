/**
 * Tab component — underline style.
 * Default: text-secondary, no underline.
 * Active: text-primary, 2px accent underline.
 */
import React from 'react';

interface TabProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabProps> = ({ tabs, activeTab, onChange }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--border-primary)',
    marginBottom: 'var(--space-4)',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 500,
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--bg-accent)' : '2px solid transparent',
    cursor: 'pointer',
    transition: `color var(--duration-fast) var(--easing-default)`,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={containerStyle} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          style={tabStyle(activeTab === tab.id)}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

Tabs.displayName = 'Tabs';
