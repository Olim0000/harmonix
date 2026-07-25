/**
 * Sidebar — fixed 200px nav, collapses to drawer on mobile.
 */
import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import {
  HomeIcon,
  LibraryIcon,
  ArtistsIcon,
  SearchIcon,
  HeartIcon,
  ServerIcon,
  SettingsIcon,
} from './icons';

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/artists', label: 'Artists', icon: ArtistsIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/liked', label: 'Liked', icon: HeartIcon },
  { to: '/playlists', label: 'Playlists', icon: LibraryIcon },
  { to: '/servers', label: 'Servers', icon: ServerIcon },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  // Close sidebar on navigation for mobile
  useEffect(() => {
    if (mobileOpen) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sidebarContent = (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 'var(--space-2)',
      }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            fontWeight: 500,
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
            textDecoration: 'none',
            transition: `background-color var(--duration-fast) var(--easing-default)`,
          })}
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
      {user?.role === 'admin' && (
        <NavLink
          to="/admin"
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            fontWeight: 500,
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
            textDecoration: 'none',
            transition: `background-color var(--duration-fast) var(--easing-default)`,
            marginTop: 8,
          })}
        >
          <SettingsIcon size={18} />
          Admin
        </NavLink>
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          height: '100%',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
          overflowY: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
        className="sidebar-desktop"
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 90,
            }}
            className="sidebar-overlay"
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: 280,
              height: '100%',
              backgroundColor: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border-primary)',
              zIndex: 91,
              overflowY: 'auto',
              paddingTop: 'var(--topbar-height)',
              animation: 'slideInLeft 0.2s ease-out',
            }}
            className="sidebar-mobile"
          >
            {sidebarContent}
          </aside>
          <style>{`
            @keyframes slideInLeft {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>
      )}
    </>
  );
};

Sidebar.displayName = 'Sidebar';
