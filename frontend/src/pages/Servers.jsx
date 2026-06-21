import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTrash2, FiPlay, FiArrowLeft, FiCheckCircle, FiXCircle, FiRefreshCw } from '../icons';
import client from '../api/client';
import { usePlayer } from '../store/PlayerContext';
import { useAuth } from '../store/AuthContext';

const NATIVE_MAIN_SERVER = { id: 0, name: 'Main Server', host: window.location.hostname, port: 3001, builtin: true };

const Servers = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('3001');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [testing, setTesting] = useState({});
  const [testResult, setTestResult] = useState({});
  const { activeServer, setActiveServer } = usePlayer();
  const { user } = useAuth();

  const fetchServers = useCallback(() => {
    setLoading(true);
    setError('');
    client.get('/servers')
      .then((res) => {
        const list = user?.is_admin
          ? [NATIVE_MAIN_SERVER, ...res.data]
          : res.data;
        setServers(list);
      })
      .catch(() => setError('Failed to load servers'))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  const handleAdd = useCallback(() => {
    if (!name.trim() || !host.trim() || adding) return;
    setAdding(true);
    setAddError('');
    client.post('/servers', { name: name.trim(), host: host.trim(), port: parseInt(port, 10) || 3001 })
      .then((res) => {
        setServers((prev) => [...prev, res.data]);
        setName('');
        setHost('');
        setPort('3001');
      })
      .catch((err) => {
        setAddError(err.response?.data?.error || 'Failed to add server');
      })
      .finally(() => setAdding(false));
  }, [name, host, port, adding]);

  const handleDelete = useCallback((id) => {
    client.delete(`/servers/${id}`)
      .then(() => {
        setServers((prev) => prev.filter((s) => s.id !== id));
      })
      .catch(() => {});
  }, []);

  const handleSelect = useCallback((server) => {
    setActiveServer({ id: server.id, name: server.name, host: server.host, port: server.port });
  }, [setActiveServer]);

  const handleTest = useCallback(async (server) => {
    setTesting((prev) => ({ ...prev, [server.id]: true }));
    setTestResult((prev) => ({ ...prev, [server.id]: null }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://${server.host}:${server.port}/api/player/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTestResult((prev) => ({ ...prev, [server.id]: res.ok ? 'online' : 'error' }));
    } catch {
      setTestResult((prev) => ({ ...prev, [server.id]: 'offline' }));
    } finally {
      setTesting((prev) => ({ ...prev, [server.id]: false }));
    }
  }, []);

  return (
    <>
      <Link to="/" className="back-link"><FiArrowLeft size={16} /> Back to Home</Link>

      <div className="page-header">
        <h1>Servers</h1>
        <p className="muted-copy">
          Register playback servers. Select a server to play audio through its speakers instead of your browser.
        </p>
      </div>

      {error && <p className="error-text">{error}</p>}

      {user?.is_admin && (
        <div className="servers-form">
          <h3>Add Server</h3>
          <div className="servers-form-row">
            <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={adding} />
            <input type="text" placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} disabled={adding} />
            <input type="number" placeholder="Port" value={port} onChange={(e) => setPort(e.target.value)} disabled={adding} style={{ width: '100px' }} />
            <button type="button" className="btn-primary" onClick={handleAdd} disabled={adding || !name.trim() || !host.trim()}>
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addError && <p className="error-text" style={{ marginTop: '8px' }}>{addError}</p>}
        </div>
      )}

      <div className="servers-table-wrap">
        {loading ? (
          <p className="loading-text">Loading servers...</p>
        ) : servers.length === 0 ? (
          <p className="muted-copy">No servers registered.</p>
        ) : (
          <table className="servers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Host</th>
                <th>Port</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => {
                const isActive = activeServer && activeServer.id === s.id;
                const isBuiltin = s.builtin;
                const result = testResult[s.id];
                const isTesting = testing[s.id];
                return (
                  <tr key={s.id} className={isActive ? 'active-row' : ''}>
                    <td>
                      {s.name}
                      {isBuiltin && <span className="builtin-badge">Built-in</span>}
                      {isActive && !isBuiltin && <span className="active-badge">Active</span>}
                    </td>
                    <td>{s.host}</td>
                    <td>{s.port}</td>
                    <td>
                      <button type="button" className="test-btn" onClick={() => handleTest(s)} disabled={isTesting} title="Test connection">
                        {isTesting ? (
                          <FiRefreshCw size={14} className="spin" />
                        ) : result === 'online' ? (
                          <FiCheckCircle size={14} style={{ color: 'var(--accent)' }} />
                        ) : result === 'error' || result === 'offline' ? (
                          <FiXCircle size={14} style={{ color: '#999' }} />
                        ) : (
                          <FiRefreshCw size={14} />
                        )}
                      </button>
                      {result === 'online' && <span className="test-label online">Online</span>}
                      {result === 'error' && <span className="test-label error">Error</span>}
                      {result === 'offline' && <span className="test-label offline">Offline</span>}
                    </td>
                    <td className="servers-actions">
                      <button type="button" className="btn-primary" onClick={() => handleSelect(s)} disabled={isActive} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                        <FiPlay size={14} style={{ marginRight: '4px' }} />
                        {isActive ? 'Selected' : 'Select'}
                      </button>
                      {!isBuiltin && (
                        <button type="button" className="btn-danger" onClick={() => handleDelete(s.id)} style={{ padding: '4px 10px', fontSize: '0.8rem', marginLeft: '6px' }}>
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default Servers;
