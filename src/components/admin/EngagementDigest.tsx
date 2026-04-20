import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { EngagementAnalytics } from './EngagementAnalytics';

interface Target {
  id: string;
  tweet_id: string;
  tweet_text: string;
  author_username: string;
  author_name: string;
  author_followers: number;
  likes: number;
  retweets: number;
  replies: number;
  tweet_url: string;
  search_query: string;
  tweeted_at: string;
  created_at: string;
  status: 'new' | 'engaged' | 'skipped';
  suggested_reply: string | null;
  suggested_image: string | null;
  notes: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: '#7C3AED33', text: '#A78BFA' },
  engaged: { bg: '#10B98133', text: '#10B981' },
  skipped: { bg: '#94A3B833', text: '#94A3B8' },
};

export function EngagementDigest() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'engaged' | 'skipped'>('new');
  const [subView, setSubView] = useState<'digest' | 'analytics'>('digest');
  const [refreshing, setRefreshing] = useState(false);
  const [reloading, setReloading] = useState(false);

  async function fetchTargets() {
    const { data } = await supabase
      .from('engagement_targets')
      .select('*')
      .order('author_followers', { ascending: false });

    if (data) setTargets(data);
    setLoading(false);
  }

  useEffect(() => { fetchTargets(); }, []);

  async function reloadTargets() {
    setReloading(true);
    await fetchTargets();
    setReloading(false);
  }

  async function markAs(id: string, status: 'engaged' | 'skipped') {
    await supabase.from('engagement_targets').update({ status }).eq('id', id);
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  }

  const filtered = filter === 'all' ? targets : targets.filter((t) => t.status === filter);
  const newCount = targets.filter((t) => t.status === 'new').length;
  const today = new Date().toISOString().split('T')[0];
  const engagedTodayCount = targets.filter((t) => t.status === 'engaged' && t.created_at?.startsWith(today)).length;
  const totalEngagedCount = targets.filter((t) => t.status === 'engaged').length;

  async function refreshDigest() {
    setRefreshing(true);
    try {
      const { data: config } = await supabase
        .from('posting_schedule')
        .select('github_token')
        .eq('id', 1)
        .single();

      const token = (config as any)?.github_token;
      if (!token) {
        alert('GitHub token not configured. Add it in Settings.');
        setRefreshing(false);
        return;
      }

      const res = await fetch(
        'https://api.github.com/repos/kjbecker85/Departure-Website/actions/workflows/engagement-digest.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({ ref: 'main' }),
        }
      );

      if (res.ok) {
        // Auto-reload after 75s — enough time for the GH Actions workflow to finish
        setTimeout(async () => {
          await fetchTargets();
          setRefreshing(false);
        }, 75000);
        alert('Digest refresh triggered. New targets will load automatically in ~75 seconds.');
        return; // keep refreshing=true until auto-reload fires
      } else {
        alert('Failed to trigger refresh. Check GitHub token.');
      }
    } catch (err) {
      alert('Error triggering refresh.');
    }
    setRefreshing(false);
  }

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading engagement targets...</p>;

  return (
    <div>
      {/* Sub-tabs + refresh */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', alignItems: 'center' }}>
        {([
          { key: 'digest' as const, label: 'Daily Digest', icon: '📬' },
          { key: 'analytics' as const, label: 'Analytics', icon: '📊' },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSubView(key)}
            style={{
              padding: '8px 18px', background: subView === key ? '#7C3AED' : '#252540',
              border: 'none', borderRadius: '8px',
              color: subView === key ? '#fff' : '#94A3B8',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {icon} {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={reloadTargets}
          disabled={reloading}
          style={{
            padding: '8px 18px', background: '#252540', border: '1px solid #7C3AED44',
            borderRadius: '8px', color: '#A78BFA',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginRight: '6px',
          }}
        >
          {reloading ? 'Loading...' : '⟳ Reload'}
        </button>
        <button
          onClick={refreshDigest}
          disabled={refreshing}
          style={{
            padding: '8px 18px', background: '#10B98122', border: '1px solid #10B98144',
            borderRadius: '8px', color: '#10B981',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {refreshing ? 'Running (~75s)...' : '🔄 Fetch Fresh Targets'}
        </button>
      </div>

      {subView === 'analytics' && <EngagementAnalytics />}

      {subView === 'digest' && <div>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, margin: '0 0 4px' }}>
          Daily Engagement Digest
        </h3>
        <p style={{ color: '#94A3B8', fontSize: '13px', margin: '0 0 16px' }}>
          People talking about fitness apps, RPGs, and gamified workouts. Reply to these for organic growth.
          Spend 5 minutes.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#7C3AED22', borderRadius: '8px', padding: '8px 16px' }}>
            <span style={{ color: '#A78BFA', fontSize: '20px', fontWeight: 700 }}>{newCount}</span>
            <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '6px' }}>new</span>
          </div>
          <div style={{ background: '#10B98122', borderRadius: '8px', padding: '8px 16px' }}>
            <span style={{ color: '#10B981', fontSize: '20px', fontWeight: 700 }}>{engagedTodayCount}</span>
            <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '6px' }}>engaged today</span>
          </div>
          <div style={{ background: '#06B6D422', borderRadius: '8px', padding: '8px 16px' }}>
            <span style={{ color: '#06B6D4', fontSize: '20px', fontWeight: 700 }}>{totalEngagedCount}</span>
            <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '6px' }}>total engaged</span>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['new', 'all', 'engaged', 'skipped'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px',
                background: filter === f ? '#7C3AED' : '#252540',
                border: 'none', borderRadius: '6px',
                color: filter === f ? '#fff' : '#94A3B8',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Target cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((target) => {
          const colors = STATUS_COLORS[target.status] || STATUS_COLORS.new;
          return (
            <div
              key={target.id}
              style={{
                background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px',
                padding: '16px',
              }}
            >
              {/* Author info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600 }}>
                    {target.author_name}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: '13px', marginLeft: '8px' }}>
                    @{target.author_username}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: '12px', marginLeft: '8px' }}>
                    {target.author_followers.toLocaleString()} followers
                  </span>
                </div>
                <span style={{
                  background: colors.bg, color: colors.text,
                  padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  {target.status}
                </span>
              </div>

              {/* Tweet text */}
              <p style={{ color: '#F1F5F9', fontSize: '13px', margin: '0 0 10px', lineHeight: '1.5' }}>
                {target.tweet_text}
              </p>

              {/* Metrics */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>❤️ {target.likes}</span>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>🔁 {target.retweets}</span>
                <span style={{ color: '#94A3B8', fontSize: '12px' }}>💬 {target.replies}</span>
                <span style={{ color: '#94A3B8', fontSize: '11px' }}>
                  {target.tweeted_at ? new Date(target.tweeted_at).toLocaleDateString() : ''}
                </span>
              </div>

              {/* Suggested reply */}
              {target.suggested_reply && (
                <div style={{
                  background: '#0F0F1A', border: '1px solid #252540', borderRadius: '8px',
                  padding: '10px 14px', marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: '#A78BFA', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                      Suggested Reply
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(target.suggested_reply || '');
                        const btn = document.getElementById(`copy-${target.id}`);
                        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 1500); }
                      }}
                      id={`copy-${target.id}`}
                      style={{
                        padding: '3px 10px', background: '#252540', border: 'none',
                        borderRadius: '4px', color: '#A78BFA', fontSize: '11px',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <p style={{ color: '#F1F5F9', fontSize: '12px', margin: 0, lineHeight: '1.5', flex: 1 }}>
                      {target.suggested_reply}
                    </p>
                    {target.suggested_image && (
                      <div style={{ flexShrink: 0, textAlign: 'center' }}>
                        <img
                          src={`https://departure.engagequalia.com/${target.suggested_image}`}
                          alt="Attach this"
                          style={{ width: '80px', height: '100px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #252540' }}
                        />
                        <a
                          href={`https://departure.engagequalia.com/${target.suggested_image}`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block', marginTop: '4px',
                            color: '#06B6D4', fontSize: '10px', textDecoration: 'none', fontWeight: 600,
                          }}
                        >
                          Save Image
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href={target.tweet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 14px', background: '#7C3AED', border: 'none',
                    borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: 600,
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  Open on X →
                </a>
                {target.status === 'new' && (
                  <>
                    <button
                      onClick={() => markAs(target.id, 'engaged')}
                      style={{
                        padding: '6px 14px', background: '#10B98122', border: '1px solid #10B98144',
                        borderRadius: '6px', color: '#10B981', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Mark Engaged
                    </button>
                    <button
                      onClick={() => markAs(target.id, 'engaged')}
                      style={{
                        padding: '6px 14px', background: '#F59E0B22', border: '1px solid #F59E0B44',
                        borderRadius: '6px', color: '#F59E0B', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Already Replied
                    </button>
                    <button
                      onClick={() => markAs(target.id, 'skipped')}
                      style={{
                        padding: '6px 14px', background: '#252540', border: 'none',
                        borderRadius: '6px', color: '#94A3B8', fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Skip
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px 0' }}>
            {filter === 'new' ? 'All caught up! Check back tomorrow.' : 'No targets match this filter.'}
          </p>
        )}
      </div>
    </div>}
    </div>
  );
}
