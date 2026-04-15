import React from 'react';

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: '#7C3AED33', text: '#A78BFA', label: 'Upcoming' },
  posted: { bg: '#10B98133', text: '#10B981', label: 'Posted' },
  skipped: { bg: '#F59E0B33', text: '#F59E0B', label: 'Skipped' },
  failed: { bg: '#EF444433', text: '#EF4444', label: 'Failed' },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.upcoming;
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {style.label}
    </span>
  );
}
