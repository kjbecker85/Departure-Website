import React from 'react';
import { useAuth } from './useAuth';
import { LoginForm } from './LoginForm';
import { Dashboard } from './Dashboard';

export default function AdminApp() {
  const { user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F0F1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <p style={{ color: '#94A3B8', fontSize: '16px' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={signIn} />;
  }

  // Double-check domain restriction client-side (RLS enforces server-side)
  if (!user.email?.endsWith('@engagequalia.com')) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F0F1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#EF4444', fontSize: '16px', fontWeight: 600 }}>Access Denied</p>
          <p style={{ color: '#94A3B8', fontSize: '14px', margin: '8px 0 20px' }}>
            Only @engagequalia.com accounts can access the dashboard.
          </p>
          <button onClick={signOut} style={{
            padding: '10px 20px', background: '#252540', border: 'none',
            borderRadius: '8px', color: '#94A3B8', cursor: 'pointer',
          }}>Sign Out</button>
        </div>
      </div>
    );
  }

  return <Dashboard userEmail={user.email} onSignOut={signOut} />;
}
