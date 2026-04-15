import React, { useState, useEffect } from 'react';
import type { PostingSchedule } from './usePosts';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  schedule: PostingSchedule | null;
  onUpdate: (updates: Partial<PostingSchedule>) => Promise<any>;
}

export function ScheduleSettings({ schedule, onUpdate }: Props) {
  const [time, setTime] = useState('10:03');
  const [frequency, setFrequency] = useState<PostingSchedule['frequency']>('daily');
  const [customDays, setCustomDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schedule) return;
    setTime(schedule.default_time.substring(0, 5));
    setFrequency(schedule.frequency);
    setCustomDays(schedule.custom_days);
    setPaused(schedule.paused);
  }, [schedule]);

  function toggleDay(day: number) {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  async function handleSave() {
    setSaving(true);
    await onUpdate({
      default_time: time + ':00',
      frequency,
      custom_days: customDays,
      paused,
    });
    setSaving(false);
  }

  if (!schedule) return null;

  return (
    <div style={{ maxWidth: '500px' }}>
      <h3 style={{ color: '#F1F5F9', fontSize: '18px', fontWeight: 600, margin: '0 0 24px' }}>
        Posting Schedule
      </h3>

      {/* Pause toggle */}
      <div style={{
        background: paused ? '#EF444422' : '#10B98122',
        border: `1px solid ${paused ? '#EF4444' : '#10B981'}`,
        borderRadius: '12px', padding: '16px', marginBottom: '24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ color: '#F1F5F9', fontSize: '14px', fontWeight: 600, margin: 0 }}>
            {paused ? 'Posting is PAUSED' : 'Posting is ACTIVE'}
          </p>
          <p style={{ color: '#94A3B8', fontSize: '12px', margin: '4px 0 0' }}>
            {paused ? 'No posts will be sent until resumed' : 'Posts will be sent on schedule'}
          </p>
        </div>
        <button
          onClick={() => setPaused(!paused)}
          style={{
            padding: '8px 20px',
            background: paused ? '#10B981' : '#EF4444',
            border: 'none', borderRadius: '8px', color: '#fff',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Posting time */}
      <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
        Daily posting time (EST)
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', background: '#0F0F1A',
          border: '1px solid #252540', borderRadius: '8px', color: '#F1F5F9',
          fontSize: '14px', marginBottom: '20px', boxSizing: 'border-box',
        }}
      />

      {/* Frequency */}
      <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
        Frequency
      </label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['daily', 'weekdays', 'custom'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFrequency(f)}
            style={{
              padding: '8px 20px',
              background: frequency === f ? '#7C3AED' : '#252540',
              border: 'none', borderRadius: '8px',
              color: frequency === f ? '#fff' : '#94A3B8',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Custom days */}
      {frequency === 'custom' && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
            Post on these days
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                style={{
                  width: '48px', height: '40px',
                  background: customDays.includes(i) ? '#7C3AED' : '#252540',
                  border: 'none', borderRadius: '8px',
                  color: customDays.includes(i) ? '#fff' : '#94A3B8',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '12px 32px', background: '#7C3AED', border: 'none',
          borderRadius: '8px', color: '#fff', fontSize: '14px',
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        {saving ? 'Saving...' : 'Save Schedule'}
      </button>
    </div>
  );
}
