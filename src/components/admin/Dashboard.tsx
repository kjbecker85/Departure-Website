import React, { useState } from 'react';
import { usePosts } from './usePosts';
import { PostList } from './PostList';
import { PostCalendar } from './PostCalendar';
import { ScheduleSettings } from './ScheduleSettings';
import { EngagementDigest } from './EngagementDigest';

type View = 'list' | 'calendar' | 'schedule' | 'engage';

const NAV_ITEMS: { key: View; label: string; icon: string }[] = [
  { key: 'list', label: 'Posts', icon: '📋' },
  { key: 'calendar', label: 'Calendar', icon: '📅' },
  { key: 'engage', label: 'Engage', icon: '💬' },
  { key: 'schedule', label: 'Settings', icon: '⚙️' },
];

interface Props {
  userEmail: string;
  onSignOut: () => void;
}

export function Dashboard({ userEmail, onSignOut }: Props) {
  const [view, setView] = useState<View>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { posts, schedule, loading, updatePost, skipPost, retryPost, postNow, updateSchedule } = usePosts();

  const posted = posts.filter((p) => p.status === 'posted').length;
  const upcoming = posts.filter((p) => p.status === 'upcoming').length;
  const failed = posts.filter((p) => p.status === 'failed').length;
  const skipped = posts.filter((p) => p.status === 'skipped').length;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F0F1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <p style={{ color: '#94A3B8', fontSize: '16px' }}>Loading dashboard...</p>
      </div>
    );
  }

  const sidebarW = sidebarCollapsed ? 64 : 220;

  return (
    <div style={{
      minHeight: '100vh', background: '#0F0F1A',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarW, minHeight: '100vh',
        background: '#1A1A2E', borderRight: '1px solid #252540',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        position: 'fixed', left: 0, top: 0, bottom: 0,
        zIndex: 200,
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? '20px 12px' : '20px 20px',
          borderBottom: '1px solid #252540',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {!sidebarCollapsed && (
            <div>
              <h1 style={{ color: '#7C3AED', fontSize: '18px', fontWeight: 700, margin: 0 }}>DEPARTURE</h1>
              <p style={{ color: '#94A3B8', fontSize: '10px', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>Marketing</p>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'none', border: 'none', color: '#94A3B8',
              cursor: 'pointer', fontSize: '16px', padding: '4px',
            }}
          >
            {sidebarCollapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Nav items */}
        <div style={{ padding: '12px 8px', flex: 1 }}>
          {NAV_ITEMS.map(({ key, label, icon }) => {
            const active = view === key;
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                style={{
                  width: '100%',
                  padding: sidebarCollapsed ? '12px 0' : '10px 14px',
                  background: active ? '#7C3AED22' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: active ? '#A78BFA' : '#94A3B8',
                  fontSize: '14px',
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '4px',
                  textAlign: 'left',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  borderLeft: active ? '3px solid #7C3AED' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
                title={sidebarCollapsed ? label : undefined}
              >
                <span style={{ fontSize: '18px' }}>{icon}</span>
                {!sidebarCollapsed && label}
              </button>
            );
          })}
        </div>

        {/* User info at bottom */}
        <div style={{
          padding: sidebarCollapsed ? '12px 8px' : '16px 20px',
          borderTop: '1px solid #252540',
        }}>
          {!sidebarCollapsed && (
            <p style={{ color: '#94A3B8', fontSize: '11px', margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </p>
          )}
          <button
            onClick={onSignOut}
            style={{
              width: '100%',
              padding: '8px 12px', background: '#252540', border: 'none',
              borderRadius: '6px', color: '#94A3B8', fontSize: '12px',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {sidebarCollapsed ? '🚪' : 'Sign Out'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, marginLeft: sidebarW, transition: 'margin-left 0.2s',
        minHeight: '100vh',
      }}>
        {/* Top bar with stats */}
        <div style={{
          background: '#1A1A2E', borderBottom: '1px solid #252540',
          padding: '16px 28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <h2 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
            {NAV_ITEMS.find((n) => n.key === view)?.icon}{' '}
            {NAV_ITEMS.find((n) => n.key === view)?.label}
          </h2>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { label: 'Upcoming', value: upcoming, color: '#7C3AED' },
              { label: 'Posted', value: posted, color: '#10B981' },
              { label: 'Failed', value: failed, color: '#EF4444' },
              { label: 'Skipped', value: skipped, color: '#F59E0B' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <span style={{ color, fontSize: '20px', fontWeight: 700 }}>{value}</span>
                <span style={{ color: '#94A3B8', fontSize: '10px', marginLeft: '4px', textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pause indicator */}
        {schedule?.paused && (
          <div style={{
            background: '#EF444422', border: '1px solid #EF4444', borderRadius: '0',
            padding: '10px 28px', textAlign: 'center',
          }}>
            <span style={{ color: '#EF4444', fontSize: '13px', fontWeight: 600 }}>
              Posting is PAUSED. Go to Settings to resume.
            </span>
          </div>
        )}

        {/* Page content */}
        <div style={{ padding: '24px 28px' }}>
          {view === 'list' && (
            <PostList posts={posts} onUpdate={updatePost} onSkip={skipPost} onRetry={retryPost} onPostNow={postNow} />
          )}
          {view === 'calendar' && (
            <PostCalendar posts={posts} onUpdate={updatePost} onSkip={skipPost} onRetry={retryPost} />
          )}
          {view === 'schedule' && (
            <ScheduleSettings schedule={schedule} onUpdate={updateSchedule} />
          )}
          {view === 'engage' && (
            <EngagementDigest />
          )}
        </div>
      </div>
    </div>
  );
}
