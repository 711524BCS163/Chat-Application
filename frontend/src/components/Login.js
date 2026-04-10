import React, { useState } from 'react';
import './Login.css';

const API = 'http://localhost:5000/api';

export default function Login({ onLogin }) {
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [username, setUser]   = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'register'
        ? { username, email, password }
        : { username, password };

      const res = await fetch(`${API}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onLogin({ token: data.token, user_id: data.user_id, username: data.username });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">⚡</div>
          <span className="logo-text">Pulse</span>
        </div>
        <p className="login-tagline">Real-time messaging, beautifully simple.</p>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >Sign In</button>
          <button
            className={`mode-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >Create Account</button>
        </div>

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={e => setUser(e.target.value)}
              placeholder="your_username"
              required
            />
          </div>

          {mode === 'register' && (
            <div className="field">
              <label>Email <span className="optional">(optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          )}

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>
      </div>
    </div>
  );
}
