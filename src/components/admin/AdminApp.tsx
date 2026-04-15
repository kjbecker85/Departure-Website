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

  return <Dashboard userEmail={user.email || ''} onSignOut={signOut} />;
}
