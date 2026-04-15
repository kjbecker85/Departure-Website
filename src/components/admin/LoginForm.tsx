import React, { useState } from 'react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.endsWith('@engagequalia.com')) {
      setError('Only @engagequalia.com accounts can access the dashboard.');
      return;
    }

    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F0F1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#1A1A2E',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        margin: '0 20px',
        border: '1px solid #252540',
      }}>
        <h1 style={{ color: '#7C3AED', fontSize: '24px', fontWeight: 700, margin: '0 0 4px', textAlign: 'center' }}>
          DEPARTURE
        </h1>
        <p style={{ color: '#94A3B8', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>
          Marketing Dashboard
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@engagequalia.com"
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#0F0F1A',
              border: '1px solid #252540',
              borderRadius: '8px',
              color: '#F1F5F9',
              fontSize: '14px',
              marginBottom: '16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#0F0F1A',
              border: '1px solid #252540',
              borderRadius: '8px',
              color: '#F1F5F9',
              fontSize: '14px',
              marginBottom: '24px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <p style={{ color: '#EF4444', fontSize: '13px', margin: '0 0 16px', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#4C1D95' : '#7C3AED',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
