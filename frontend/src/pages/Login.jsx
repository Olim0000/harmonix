import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../store/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (registering) {
        await client.post('/auth/register', { username, password });
        const response = await client.post('/auth/login', { username, password });
        login({ username, is_admin: response.data.is_admin }, response.data.token);
        navigate('/');
      } else {
        const response = await client.post('/auth/login', { username, password });
        login({ username, is_admin: response.data.is_admin }, response.data.token);
        navigate('/');
      }
    } catch (error) {
      console.error('Auth failed:', error);
      setError(error.response?.data?.message || (registering ? 'Registration failed.' : 'Invalid username or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', minWidth: '280px' }}>
        <h2 style={{ margin: 0, marginBottom: '10px', color: 'var(--text)' }}>{registering ? 'Register' : 'Login'}</h2>
        {error && <p style={{ margin: '0 0 10px', color: '#999' }}>{error}</p>}
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: '5px', color: 'var(--text)' }}>Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '5px', color: 'var(--text)' }}>Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', border: 'none', borderRadius: '4px', boxSizing: 'border-box' }}
          />
        </div>
        <button type="submit" disabled={submitting} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Submitting...' : (registering ? 'Register' : 'Login')}
        </button>
        <p style={{ marginTop: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {registering ? (
            <>Already have an account? <button type="button" onClick={() => { setRegistering(false); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Login</button></>
          ) : (
            <>Don't have an account? <button type="button" onClick={() => { setRegistering(true); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Register</button></>
          )}
        </p>
      </form>
    </div>
  );
};

export default Login;
