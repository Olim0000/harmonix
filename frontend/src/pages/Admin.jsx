import React, { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';
import { useAuthStore } from '../store/authStore';

const Admin = () => {
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetError, setResetError] = useState('');

  // db update state
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');

  useEffect(() => {
    if (tab !== 'users') return;
    setLoading(true);
    setError('');
    client.get('/admin/users')
      .then((res) => setUsers(res.data))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false));
  }, [tab]);

  const handleDelete = useCallback((userId) => {
    if (!window.confirm('Delete this user?')) return;
    client.delete(`/admin/users/${userId}`)
      .then(() => setUsers((prev) => prev.filter((u) => u.id !== userId)))
      .catch((err) => setError(err.response?.data?.message || 'Failed to delete user'));
  }, []);

  const handleSetAdmin = useCallback((userId, makeAdmin) => {
    client.post(`/admin/users/${userId}/set-admin`, { is_admin: makeAdmin })
      .then(() => setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_admin: makeAdmin ? 1 : 0 } : u)))
      .catch((err) => setError(err.response?.data?.message || 'Failed to update admin status'));
  }, []);

  const handleResetPassword = useCallback((userId) => {
    if (!resetPw.trim() || resetPw.length < 3) {
      setResetError('Password must be at least 3 characters');
      return;
    }
    setResetError('');
    client.post(`/admin/users/${userId}/reset-password`, { password: resetPw })
      .then(() => { setResetUserId(null); setResetPw(''); })
      .catch((err) => setResetError(err.response?.data?.message || 'Failed to reset password'));
  }, [resetPw]);

  const handleUpdateDb = useCallback(() => {
    if (running) return;
    setRunning(true);
    setLog('Starting enrich-music.js...\n');

    fetch('http://localhost:3001/api/admin/update-db', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setLog((prev) => prev + decoder.decode(value, { stream: true }));
      }
    }).catch((err) => {
      setLog((prev) => prev + `\nError: ${err.message}\n`);
    }).finally(() => setRunning(false));
  }, [running]);

  return (
    <>
      <div className="app-shell">
        <Sidebar />
        <main className="content">
          <div className="page-header">
            <h1>Admin</h1>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                type="button"
                className={tab === 'users' ? 'btn-primary' : ''}
                onClick={() => setTab('users')}
                style={{ background: tab === 'users' ? 'var(--accent)' : 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Users
              </button>
              <button
                type="button"
                className={tab === 'db' ? 'btn-primary' : ''}
                onClick={() => setTab('db')}
                style={{ background: tab === 'db' ? 'var(--accent)' : 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Database
              </button>
            </div>
          </div>

          {tab === 'users' && (
            <>
              {error && <p className="error-text">{error}</p>}
              {loading && <p className="loading-text">Loading users...</p>}
              {!loading && !error && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px' }}>Username</th>
                      <th style={{ padding: '8px' }}>Admin</th>
                      <th style={{ padding: '8px' }}>Registered</th>
                      <th style={{ padding: '8px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 8px' }}>{u.username}</td>
                        <td style={{ padding: '10px 8px' }}>{u.is_admin ? 'Yes' : ''}</td>
                        <td style={{ padding: '10px 8px', color: 'var(--text-muted)' }}>{u.created_at}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {Number(u.id) === Number(currentUser?.id) ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>You</span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSetAdmin(u.id, !u.is_admin)}
                                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
                                >
                                  {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() => handleDelete(u.id)}
                                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => { setResetUserId(u.id); setResetPw(''); setResetError(''); }}
                              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}
                            >
                              Reset PW
                            </button>
                            {resetUserId === u.id && (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={resetPw}
                                  onChange={(e) => setResetPw(e.target.value)}
                                  placeholder="New password"
                                  style={{ width: '120px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--bg-surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: '0.8rem' }}
                                />
                                <button type="button" className="btn-primary" onClick={() => handleResetPassword(u.id)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                                  Save
                                </button>
                                {resetError && <span style={{ color: '#ff7b7b', fontSize: '0.8rem' }}>{resetError}</span>}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {tab === 'db' && (
            <div>
              <p className="muted-copy">
                This will scan the music folder and update the database with new tracks, metadata, and covers.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUpdateDb}
                disabled={running}
              >
                {running ? 'Updating...' : 'Update Database'}
              </button>
              {log && (
                <pre style={{
                  marginTop: '16px', padding: '12px', background: '#000', color: '#0f0',
                  borderRadius: '4px', fontSize: '0.8rem', maxHeight: '400px', overflow: 'auto',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {log}
                </pre>
              )}
            </div>
          )}
        </main>
      </div>
      <Player />
    </>
  );
};

export default Admin;
