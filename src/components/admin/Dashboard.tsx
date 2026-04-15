import React, { useState } from 'react';
import { usePosts } from './usePosts';
import { PostList } from './PostList';
import { PostCalendar } from './PostCalendar';
import { ScheduleSettings } from './ScheduleSettings';

type View = 'list' | 'calendar' | 'schedule';

interface Props {
  userEmail: string;
  onSignOut: () => void;
}

export function Dashboard({ userEmail, onSignOut }: Props) {
  const [view, setView] = useState<View>('list');
  const { posts, schedule, loading, updatePost, skipPost, retryPost, updateSchedule } = usePosts();

  const posted = posts.filter((p) => p.status === 'posted').length;
  const upcoming = posts.filter((p) => p.status === 'upcoming').length;
  const failed = posts.filter((p) => p.status === 'failed').length;
  const skipped = posts.filter((p) => p.status === 'skipped').length;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F0F1A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <p style={{ color: '#94A3B8', fontSize: '16px' }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0F0F1A',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Top bar */}
      <div style={{
        background: '#1A1A2E', borderBottom: '1px solid #252540',
        padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ color: '#7C3AED', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            DEPARTURE
          </h1>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>Marketing Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#94A3B8', fontSize: '13px' }}>{userEmail}</span>
          <button onClick={onSignOut} style={{
            padding: '6px 14px', background: '#252540', border: 'none',
            borderRadius: '6px', color: '#94A3B8', fontSize: '12px', cursor: 'pointer',
          }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
        {/* Stats bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
          marginBottom: '24px',
        }}>
          {[
            { label: 'Upcoming', value: upcoming, color: '#7C3AED' },
            { label: 'Posted', value: posted, color: '#10B981' },
            { label: 'Failed', value: failed, color: '#EF4444' },
            { label: 'Skipped', value: skipped, color: '#F59E0B' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px',
              padding: '16px', textAlign: 'center',
            }}>
              <p style={{ color, fontSize: '28px', fontWeight: 700, margin: 0 }}>{value}</p>
              <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0', textTransform: 'uppercase' }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Pause indicator */}
        {schedule?.paused && (
          <div style={{
            background: '#EF444422', border: '1px solid #EF4444', borderRadius: '12px',
            padding: '12px 20px', marginBottom: '20px', textAlign: 'center',
          }}>
            <p style={{ color: '#EF4444', fontSize: '14px', fontWeight: 600, margin: 0 }}>
              ⚠ Posting is PAUSED — no posts will be sent until resumed
            </p>
          </div>
        )}

        {/* View tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
          {([
            { key: 'list', label: 'List View' },
            { key: 'calendar', label: 'Calendar' },
            { key: 'schedule', label: 'Schedule' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              style={{
                padding: '10px 20px',
                background: view === key ? '#7C3AED' : '#1A1A2E',
                border: `1px solid ${view === key ? '#7C3AED' : '#252540'}`,
                borderRadius: '8px',
                color: view === key ? '#fff' : '#94A3B8',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === 'list' && (
          <PostList posts={posts} onUpdate={updatePost} onSkip={skipPost} onRetry={retryPost} />
        )}
        {view === 'calendar' && (
          <PostCalendar posts={posts} onUpdate={updatePost} onSkip={skipPost} onRetry={retryPost} />
        )}
        {view === 'schedule' && (
          <ScheduleSettings schedule={schedule} onUpdate={updateSchedule} />
        )}
      </div>
    </div>
  );
}
