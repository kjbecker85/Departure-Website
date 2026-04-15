import React, { useState, useEffect } from 'react';
import type { SocialPost } from './usePosts';
import { StatusBadge } from './StatusBadge';

const SITE_BASE = 'https://departure.engagequalia.com';

interface Props {
  post: SocialPost;
  onSave: (id: string, updates: Partial<SocialPost>) => Promise<any>;
  onSkip: (id: string) => Promise<any>;
  onRetry: (id: string) => Promise<any>;
  onClose: () => void;
}

export function PostEditor({ post, onSave, onSkip, onRetry, onClose }: Props) {
  const [xText, setXText] = useState(post.x_text || '');
  const [igText, setIgText] = useState(post.ig_text || '');
  const [date, setDate] = useState(post.scheduled_date);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setXText(post.x_text || '');
    setIgText(post.ig_text || '');
    setDate(post.scheduled_date);
  }, [post]);

  async function handleSave() {
    setSaving(true);
    await onSave(post.id, {
      x_text: xText,
      ig_text: igText,
      scheduled_date: date,
    });
    setSaving(false);
    onClose();
  }

  const imageUrl = post.image_path ? `${SITE_BASE}/${post.image_path}` : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }} onClick={onClose}>
      <div style={{
        background: '#1A1A2E', borderRadius: '16px', padding: '28px',
        width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid #252540',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, margin: 0 }}>
              Edit Post
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0' }}>
              {post.post_type.toUpperCase()} — {post.scheduled_date}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatusBadge status={post.status} />
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#94A3B8', fontSize: '20px', cursor: 'pointer',
            }}>✕</button>
          </div>
        </div>

        {/* Image Preview */}
        {imageUrl && (
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <img
              src={imageUrl}
              alt="Post image"
              style={{ maxWidth: '200px', maxHeight: '250px', borderRadius: '8px', border: '1px solid #252540' }}
            />
            <p style={{ color: '#94A3B8', fontSize: '11px', marginTop: '6px' }}>{post.image_path}</p>
          </div>
        )}

        {/* Date */}
        <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Scheduled Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={post.status === 'posted'}
          style={{
            width: '100%', padding: '10px 14px', background: '#0F0F1A',
            border: '1px solid #252540', borderRadius: '8px', color: '#F1F5F9',
            fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box',
          }}
        />

        {/* X Text */}
        <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          X (Twitter) — {xText.length}/280
        </label>
        <textarea
          value={xText}
          onChange={(e) => setXText(e.target.value)}
          disabled={post.status === 'posted'}
          rows={5}
          style={{
            width: '100%', padding: '10px 14px', background: '#0F0F1A',
            border: `1px solid ${xText.length > 280 ? '#EF4444' : '#252540'}`,
            borderRadius: '8px', color: '#F1F5F9', fontSize: '14px',
            marginBottom: '16px', resize: 'vertical', fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        />

        {/* IG Text */}
        <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
          Instagram — {igText.length}/2200
        </label>
        <textarea
          value={igText}
          onChange={(e) => setIgText(e.target.value)}
          disabled={post.status === 'posted'}
          rows={6}
          style={{
            width: '100%', padding: '10px 14px', background: '#0F0F1A',
            border: `1px solid ${igText.length > 2200 ? '#EF4444' : '#252540'}`,
            borderRadius: '8px', color: '#F1F5F9', fontSize: '14px',
            marginBottom: '16px', resize: 'vertical', fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        />

        {/* Error message (if failed) */}
        {post.status === 'failed' && post.error_message && (
          <div style={{
            background: '#EF444422', border: '1px solid #EF4444', borderRadius: '8px',
            padding: '12px', marginBottom: '16px',
          }}>
            <p style={{ color: '#EF4444', fontSize: '13px', margin: 0 }}>
              Error: {post.error_message}
            </p>
            <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>
              Retry count: {post.retry_count}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {post.status !== 'posted' && (
            <button onClick={handleSave} disabled={saving} style={{
              padding: '10px 20px', background: '#7C3AED', border: 'none',
              borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', flex: 1,
            }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}

          {post.status === 'upcoming' && (
            <button onClick={() => { onSkip(post.id); onClose(); }} style={{
              padding: '10px 20px', background: '#F59E0B33', border: '1px solid #F59E0B',
              borderRadius: '8px', color: '#F59E0B', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}>
              Skip
            </button>
          )}

          {(post.status === 'failed' || post.status === 'skipped') && (
            <button onClick={() => { onRetry(post.id); onClose(); }} style={{
              padding: '10px 20px', background: '#06B6D433', border: '1px solid #06B6D4',
              borderRadius: '8px', color: '#06B6D4', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}>
              {post.status === 'failed' ? 'Retry' : 'Restore'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
