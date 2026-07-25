/**
 * Shell — top bar + sidebar + main content area layout.
 * Top bar 48px, sidebar 200px (drawer on <768px).
 * Renders PlayerBar at bottom, QueueDrawer and FullscreenOverlay.
 * Registers keyboard shortcuts.
 */
import React, { useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import { Sidebar } from './Sidebar';
import { ToastContainer } from './ui/Toast';
import { PlayerBar } from './PlayerBar';
import { QueueDrawer } from './QueueDrawer';
import { FullscreenOverlay } from './FullscreenOverlay';
import { MenuIcon, SearchIcon } from './icons';
import { useNavigate } from 'react-router-dom';
import { useShortcuts } from '../hooks/useShortcuts';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  // M10: Swipe gesture refs for mobile sidebar
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      // Only trigger on mostly-horizontal swipes (|dx| > |dy|)
      if (Math.abs(deltaX) < 80 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      if (deltaX > 0 && !sidebarOpen) {
        setSidebarOpen(true);
      } else if (deltaX < 0 && sidebarOpen) {
        setSidebarOpen(false);
      }
    },
    [sidebarOpen, setSidebarOpen]
  );

  // Register keyboard shortcuts
  useShortcuts();

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          height: 'var(--topbar-height)',
          minHeight: 'var(--topbar-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-4)',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-primary)',
          zIndex: 50,
          gap: 12,
        }}
      >
        <button
          onClick={toggleSidebar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Toggle sidebar"
          className="sidebar-toggle"
        >
          <MenuIcon size={20} />
        </button>

        <span
          className="text-base"
          style={{ fontWeight: 700, color: 'var(--text-primary)' }}
        >
          Harmonix
        </span>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => navigate('/search')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Search"
          className="search-toggle"
        >
          <SearchIcon size={18} />
        </button>

        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
              position: 'relative',
            }}
            className="user-menu-trigger"
          >
            <span
              className="text-sm"
              style={{
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.username}
            </span>
            <button
              onClick={logout}
              className="text-xs"
              style={{
                color: 'var(--text-tertiary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Body: sidebar + main */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content (M10: swipe gestures for mobile sidebar) */}
        <main
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-6)',
            paddingBottom: 'calc(var(--space-6) + var(--playerbar-height))',
          }}
          id="main-content"
        >
          {children}
        </main>
      </div>

      {/* Player bar */}
      <PlayerBar />

      {/* Queue drawer */}
      <QueueDrawer />

      {/* Fullscreen overlay */}
      <FullscreenOverlay />

      {/* Toasts */}
      <ToastContainer />

      {/* Mobile sidebar style override */}
      <style>{`
        @media (max-width: 767px) {
          .sidebar-desktop { display: none; }
          .album-card-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 768px) {
          .sidebar-mobile,
          .sidebar-overlay { display: none; }
          .sidebar-toggle { display: none; }
        }
        .album-card:hover .play-overlay { opacity: 1; }
      `}</style>
    </div>
  );
};

Shell.displayName = 'Shell';
