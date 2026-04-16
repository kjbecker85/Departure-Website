import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Target {
  id: string;
  tweet_id: string;
  tweet_text: string;
  author_username: string;
  author_name: string;
  author_followers: number;
  tweet_url: string;
  search_query: string;
  status: string;
  created_at: string;
}

export function EngagementAnalytics() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('engagement_targets')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setTargets(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p style={{ color: '#94A3B8' }}>Loading analytics...</p>;

  const engaged = targets.filter((t) => t.status === 'engaged');
  const skipped = targets.filter((t) => t.status === 'skipped');

  // Top accounts we've engaged with (by follower count)
  const topAccounts = [...engaged]
    .sort((a, b) => b.author_followers - a.author_followers)
    .reduce((acc: Target[], t) => {
      if (!acc.find((a) => a.author_username === t.author_username)) acc.push(t);
      return acc;
    }, [])
    .slice(0, 10);

  // Unique accounts engaged
  const uniqueAccounts = new Set(engaged.map((t) => t.author_username)).size;

  // Total reach (sum of followers of engaged accounts)
  const uniqueEngaged = engaged.reduce((acc: Record<string, number>, t) => {
    if (!acc[t.author_username]) acc[t.author_username] = t.author_followers;
    return acc;
  }, {});
  const totalReach = Object.values(uniqueEngaged).reduce((a, b) => a + b, 0);

  // Engagement by day
  const byDay: Record<string, number> = {};
  for (const t of engaged) {
    const day = t.created_at?.split('T')[0] || 'unknown';
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDayCount = Math.max(...days.map(([, c]) => c), 1);

  // Category breakdown from search queries
  const categories: Record<string, number> = {};
  for (const t of engaged) {
    const q = t.search_query || '';
    let cat = 'Other';
    if (q.includes('rpg') || q.includes('gamif')) cat = 'RPG/Gamified';
    else if (q.includes('fitness app') || q.includes('gym app') || q.includes('workout app')) cat = 'Fitness Apps';
    else if (q.includes('tracker')) cat = 'Workout Tracking';
    else if (q.includes('motivation') || q.includes('gains')) cat = 'Motivation';
    else if (q.includes('game')) cat = 'Fitness Games';
    else if (q.includes('PR') || q.includes('record')) cat = 'Personal Records';
    else if (q.includes('buddy') || q.includes('partner')) cat = 'Gym Partners';
    categories[cat] = (categories[cat] || 0) + 1;
  }
  const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  const maxCatCount = Math.max(...Object.values(categories), 1);

  const catColors: Record<string, string> = {
    'RPG/Gamified': '#7C3AED',
    'Fitness Apps': '#06B6D4',
    'Workout Tracking': '#10B981',
    'Motivation': '#F59E0B',
    'Fitness Games': '#A78BFA',
    'Personal Records': '#EF4444',
    'Gym Partners': '#F97316',
    'Other': '#94A3B8',
  };

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
        {[
          { label: 'Total Engaged', value: engaged.length, color: '#10B981' },
          { label: 'Unique Accounts', value: uniqueAccounts, color: '#06B6D4' },
          { label: 'Est. Reach', value: totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach, color: '#7C3AED' },
          { label: 'Skipped', value: skipped.length, color: '#94A3B8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
          }}>
            <p style={{ color, fontSize: '28px', fontWeight: 700, margin: 0 }}>{value}</p>
            <p style={{ color: '#94A3B8', fontSize: '11px', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
        {/* Daily Activity */}
        <div style={{ background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px', padding: '20px' }}>
          <h4 style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
            Daily Engagements
          </h4>
          {days.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '13px' }}>No engagement data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {days.map(([day, count]) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#94A3B8', fontSize: '12px', width: '80px', flexShrink: 0 }}>
                    {new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div style={{ flex: 1, background: '#252540', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxDayCount) * 100}%`,
                      height: '100%', background: '#10B981', borderRadius: '4px',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 600, width: '24px', textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div style={{ background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px', padding: '20px' }}>
          <h4 style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
            Engagement by Category
          </h4>
          {sortedCategories.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: '13px' }}>No engagement data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {sortedCategories.map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#94A3B8', fontSize: '12px', width: '110px', flexShrink: 0 }}>{cat}</span>
                  <div style={{ flex: 1, background: '#252540', borderRadius: '4px', height: '20px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxCatCount) * 100}%`,
                      height: '100%', background: catColors[cat] || '#94A3B8', borderRadius: '4px',
                    }} />
                  </div>
                  <span style={{ color: catColors[cat] || '#94A3B8', fontSize: '12px', fontWeight: 600, width: '24px', textAlign: 'right' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Accounts */}
      <div style={{ background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
        <h4 style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
          Top Accounts Engaged
        </h4>
        {topAccounts.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Engage with some tweets to see your top accounts.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
            {topAccounts.map((t, i) => (
              <a
                key={t.id}
                href={`https://x.com/${t.author_username}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', background: '#252540', borderRadius: '8px',
                  textDecoration: 'none', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#303050'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#252540'}
              >
                <span style={{
                  color: i < 3 ? '#F59E0B' : '#94A3B8',
                  fontSize: '14px', fontWeight: 700, width: '24px',
                }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#F1F5F9', fontSize: '13px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.author_name}
                  </p>
                  <p style={{ color: '#94A3B8', fontSize: '11px', margin: '2px 0 0' }}>
                    @{t.author_username}
                  </p>
                </div>
                <span style={{ color: '#06B6D4', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                  {t.author_followers >= 1000 ? `${(t.author_followers / 1000).toFixed(1)}K` : t.author_followers}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Recent Engagement History */}
      <div style={{ background: '#1A1A2E', border: '1px solid #252540', borderRadius: '12px', padding: '20px' }}>
        <h4 style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>
          Recent Engagement History
        </h4>
        {engaged.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>No engagements yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {engaged.slice(0, 20).map((t) => (
              <a
                key={t.id}
                href={t.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '8px 12px', borderRadius: '6px',
                  textDecoration: 'none', background: 'transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#252540'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ color: '#10B981', fontSize: '10px' }}>●</span>
                <span style={{ color: '#94A3B8', fontSize: '11px', width: '70px', flexShrink: 0 }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
                <span style={{ color: '#F1F5F9', fontSize: '12px', fontWeight: 600, width: '120px', flexShrink: 0 }}>
                  @{t.author_username}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.tweet_text?.substring(0, 80)}...
                </span>
                <span style={{ color: '#06B6D4', fontSize: '11px', flexShrink: 0 }}>
                  {t.author_followers >= 1000 ? `${(t.author_followers / 1000).toFixed(1)}K` : t.author_followers}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
