import React, { useState } from 'react';
import type { SocialPost } from './usePosts';
import { StatusBadge } from './StatusBadge';
import { PostEditor } from './PostEditor';

const SITE_BASE = 'https://departure.engagequalia.com';
const FILTERS = ['all', 'upcoming', 'posted', 'skipped', 'failed'] as const;

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

export function PostList({ posts, onUpdate, onSkip, onRetry }: Props) {
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.status === filter);

  const counts: Record<string, number> = {
    all: posts.length,
    upcoming: posts.filter((p) => p.status === 'upcoming').length,
    posted: posts.filter((p) => p.status === 'posted').length,
    skipped: posts.filter((p) => p.status === 'skipped').length,
    failed: posts.filter((p) => p.status === 'failed').length,
  };

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px',
              background: filter === f ? '#7C3AED' : '#252540',
              border: 'none',
              borderRadius: '8px',
              color: filter === f ? '#fff' : '#94A3B8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Post cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((post) => {
          const isToday = post.scheduled_date === today;
          return (
            <div
              key={post.id}
              onClick={() => setEditingPost(post)}
              style={{
                background: '#1A1A2E',
                border: `1px solid ${isToday ? '#7C3AED' : '#252540'}`,
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7C3AED')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = isToday ? '#7C3AED' : '#252540')}
            >
              {/* Image thumbnail */}
              {post.image_path ? (
                <img
                  src={`${SITE_BASE}/${post.image_path}`}
                  alt=""
                  style={{
                    width: '48px', height: '60px', borderRadius: '6px',
                    objectFit: 'cover', flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: '48px', height: '60px', borderRadius: '6px',
                  background: '#252540', flexShrink: 0,
                }} />
              )}

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {post.scheduled_date}
                    {isToday && <span style={{ color: '#7C3AED', marginLeft: '6px' }}>TODAY</span>}
                  </span>
                  <span style={{ fontSize: '14px' }}>{TYPE_ICONS[post.post_type] || '📝'}</span>
                  <span style={{ color: '#94A3B8', fontSize: '12px', textTransform: 'uppercase' }}>
                    {post.post_type}
                  </span>
                  <StatusBadge status={post.status} />
                </div>
                <p style={{
                  color: '#F1F5F9', fontSize: '13px', margin: 0,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {post.x_text?.split('\n')[0] || 'No text'}
                </p>
              </div>

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {post.status === 'upcoming' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSkip(post.id); }}
                    title="Skip"
                    style={{
                      padding: '6px 10px', background: '#F59E0B22', border: '1px solid #F59E0B44',
                      borderRadius: '6px', color: '#F59E0B', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    Skip
                  </button>
                )}
                {(post.status === 'failed' || post.status === 'skipped') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetry(post.id); }}
                    title={post.status === 'failed' ? 'Retry' : 'Restore'}
                    style={{
                      padding: '6px 10px', background: '#06B6D422', border: '1px solid #06B6D444',
                      borderRadius: '6px', color: '#06B6D4', fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {post.status === 'failed' ? 'Retry' : 'Restore'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>
            No posts match this filter.
          </p>
        )}
      </div>

      {/* Editor modal */}
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
