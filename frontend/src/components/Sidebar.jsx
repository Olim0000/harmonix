import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMenu, FiX } from '../icons';
import client from '../api/client';
import { useAuth } from '../store/AuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [playlistError, setPlaylistError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchPlaylists = useCallback(() => {
    client.get('/playlists')
      .then((res) => setPlaylists(res.data))
      .catch(() => setPlaylistError('Could not load playlists'));
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleCreate = useCallback(() => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setCreateError('');
    client.post('/playlists', { name: newName.trim() })
      .then((res) => {
        setPlaylists((prev) => [...prev, res.data]);
        setNewName('');
        setShowCreate(false);
      })
      .catch((err) => {
        setCreateError(err.response?.data?.message || 'Failed to create playlist');
      })
      .finally(() => setCreating(false));
  }, [newName, creating]);

  return (
    <>
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {menuOpen && <div className="sidebar-overlay" onClick={closeMenu} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">Harmonix</div>
        <ul>
          <li>
            <Link to="/" onClick={closeMenu}>Home</Link>
          </li>
          <li>
            <Link to="/search" onClick={closeMenu}>Search</Link>
          </li>
          <li>
            <Link to="/library" onClick={closeMenu}>Library</Link>
          </li>
          <li>
            <Link to="/artists" onClick={closeMenu}>Artists</Link>
          </li>
          {user?.is_admin && (
            <li>
              <Link to="/admin" onClick={closeMenu}>Admin</Link>
            </li>
          )}
          <li>
            <Link to="/servers" onClick={closeMenu}>Servers</Link>
          </li>
          <li>
            <Link to="/liked" onClick={closeMenu}>Liked</Link>
          </li>
        </ul>

        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 12px' }}>
            <Link to="/playlists" onClick={closeMenu} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none' }}>
              Playlists
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px', borderRadius: '4px' }}
              title="Create playlist"
            >
              +
            </button>
          </div>
          {playlistError && <p style={{ paddingLeft: '24px', fontSize: '0.8rem', color: '#999' }}>{playlistError}</p>}
          {playlists.map((pl) => (
            <Link key={pl.id} to={`/playlist/${pl.id}`} onClick={closeMenu} style={{ paddingLeft: '24px' }}>
              {pl.name}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <span>{user?.username || 'Signed in'}</span>
          <button type="button" onClick={handleLogout}>Logout</button>
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>New Playlist</h3>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name"
                autoFocus
                disabled={creating}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              />
              {createError && <p style={{ fontSize: '0.85rem', color: '#999', margin: '8px 0 0' }}>{createError}</p>}
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
                <button type="button" className="primary" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
