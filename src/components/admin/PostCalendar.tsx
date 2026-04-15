import React, { useState } from 'react';
import type { SocialPost } from './usePosts';
import { PostEditor } from './PostEditor';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#7C3AED',
  posted: '#10B981',
  skipped: '#F59E0B',
  failed: '#EF4444',
};

const TYPE_ICONS: Record<string, string> = {
  monster: '🐉',
  feature: '⚡',
  engagement: '💬',
  announcement: '📢',
};

interface Props {
  posts: SocialPost[];
  onUpdate: (id: string, updates: Partial<SocialPost>) => Promise<any>;
  onSkip: (id: string) => Promise<any>;
  onRetry: (id: string) => Promise<any>;
}

export function PostCalendar({ posts, onUpdate, onSkip, onRetry }: Props) {
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const today = now.toISOString().split('T')[0];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  // Map posts by date
  const postsByDate: Record<string, SocialPost> = {};
  for (const post of posts) {
    postsByDate[post.scheduled_date] = post;
  }

  const cells: React.ReactNode[] = [];

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} style={{ background: '#0F0F1A', borderRadius: '8px', minHeight: '80px' }} />);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const post = postsByDate[dateStr];
    const isToday = dateStr === today;

    cells.push(
      <div
        key={dateStr}
        onClick={() => post && setEditingPost(post)}
        style={{
          background: isToday ? '#252540' : '#1A1A2E',
          border: `1px solid ${isToday ? '#7C3AED' : '#252540'}`,
          borderRadius: '8px',
          padding: '8px',
          minHeight: '80px',
          cursor: post ? 'pointer' : 'default',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={(e) => post && (e.currentTarget.style.borderColor = '#7C3AED')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = isToday ? '#7C3AED' : '#252540')}
      >
        <div style={{
          fontSize: '12px',
          color: isToday ? '#7C3AED' : '#94A3B8',
          fontWeight: isToday ? 700 : 400,
          marginBottom: '6px',
        }}>
          {d}
        </div>
        {post && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px' }}>{TYPE_ICONS[post.post_type] || '📝'}</span>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: STATUS_COLORS[post.status] || '#94A3B8',
            }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Month navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px',
      }}>
        <button onClick={prevMonth} style={{
          background: '#252540', border: 'none', borderRadius: '8px',
          padding: '8px 16px', color: '#F1F5F9', cursor: 'pointer', fontSize: '14px',
        }}>
          ← Prev
        </button>
        <h3 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
          {monthLabel}
        </h3>
        <button onClick={nextMonth} style={{
          background: '#252540', border: 'none', borderRadius: '8px',
          padding: '8px 16px', color: '#F1F5F9', cursor: 'pointer', fontSize: '14px',
        }}>
          Next →
        </button>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '4px', marginBottom: '4px',
      }}>
        {DAYS.map((day) => (
          <div key={day} style={{
            textAlign: 'center', color: '#94A3B8', fontSize: '12px',
            fontWeight: 600, padding: '6px 0',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px',
      }}>
        {cells}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px', justifyContent: 'center' }}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
            <span style={{ color: '#94A3B8', fontSize: '12px', textTransform: 'capitalize' }}>{status}</span>
          </div>
        ))}
      </div>

      {editingPost && (
        <PostEditor
          post={editingPost}
          onSave={onUpdate}
          onSkip={onSkip}
          onRetry={onRetry}
          onClose={() => setEditingPost(null)}
        />
      )}
    </div>
  );
}
