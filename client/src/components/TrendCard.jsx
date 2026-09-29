import React, { useState } from 'react';
import { formatDate } from '../utils.js';

const STATUS_STYLES = {
  confirmed: { label: '🔒 Confirmed', color: '#4fffb0', background: 'rgba(79,255,176,0.07)', border: 'rgba(79,255,176,0.3)' },
  emerging:  { label: '🔍 Emerging',  color: '#f59e0b', background: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.3)' },
  cooled:    { label: 'Archived',     color: '#505a6e', background: 'transparent',            border: 'rgba(255,255,255,0.07)' },
};

const SIGNAL_LABELS = {
  source_authority: 'Named source',
  claim_magnitude:  'Big claim',
  cross_topic:      'Cross-industry',
  velocity:         'Fast-breaking',
};

export default function TrendCard({ trend }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[trend.status] || STATUS_STYLES.emerging;
  const dateRange = trend.status === 'cooled' && trend.cooledAt
    ? `${formatDate(trend.firstDetected)} → ${formatDate(trend.cooledAt)}`
    : `${formatDate(trend.firstDetected)} → ${formatDate(trend.lastActive)}`;

  return (
    <div style={{
      background: '#11141c', border: `1px solid ${style.border}`, borderRadius: 10,
      padding: '14px 16px', marginBottom: 8, opacity: trend.status === 'cooled' ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>{trend.name}</div>
        <span style={{
          fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, padding: '3px 8px', borderRadius: 4,
          background: style.background, color: style.color, border: `1px solid ${style.border}`, whiteSpace: 'nowrap',
        }}>{style.label}</span>
      </div>

      <div style={{ fontSize: 12, color: '#8a94a8', lineHeight: 1.55, marginBottom: 10 }}>{trend.rationale}</div>

      {trend.status === 'emerging' && trend.signalTypes?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {trend.signalTypes.map(s => (
            <span key={s} style={{
              fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, padding: '3px 7px', borderRadius: 3,
              background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{SIGNAL_LABELS[s] || s}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', marginBottom: expanded ? 10 : 0 }}>
        <span>{dateRange}</span>
        <span>{trend.articleCount} article{trend.articleCount === 1 ? '' : 's'}</span>
        <span>{trend.sources?.join(', ')}</span>
        <button onClick={() => setExpanded(e => !e)} style={{
          background: 'none', border: 'none', color: '#4fffb0', cursor: 'pointer',
          fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, marginLeft: 'auto', padding: 0,
        }}>{expanded ? 'Hide articles ▴' : 'Show articles ▾'}</button>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trend.articles?.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px',
              background: '#171c27', borderRadius: 6, textDecoration: 'none',
            }}>
              <span style={{ fontSize: 12, color: '#dde2ed' }}>{a.title}</span>
              <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', whiteSpace: 'nowrap' }}>{a.source} · {formatDate(a.publishedAt)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
