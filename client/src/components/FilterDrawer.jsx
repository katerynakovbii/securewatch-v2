import React from 'react';
import { TOPICS, SORT_OPTIONS } from '../utils.js';

const RANGES = [
  { value: 1,  label: 'Today only' },
  { value: 2,  label: 'Last 2 days' },
  { value: 3,  label: 'Last 3 days' },
  { value: 7,  label: 'Last 7 days' },
  { value: 14, label: 'Last 2 weeks' },
  { value: 30, label: 'Last 30 days' },
];

export default function FilterDrawer({ open, onClose, topic, setTopic, sort, setSort, counts, days, onSwitchRange }) {
  if (!open) return null;

  function handleTopicSelect(key) {
    setTopic(key);
    onClose();
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400 }}
      />
      <div style={{
        position: 'fixed', bottom: 56, left: 0, right: 0,
        background: '#11141c', borderRadius: '16px 16px 0 0',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        maxHeight: '80vh', overflowY: 'auto',
        zIndex: 401, animation: 'slideUp .25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          position: 'sticky', top: 0, background: '#11141c',
        }}>
          <span style={{
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 10,
            color: '#505a6e', textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>Filters</span>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: '#171c27', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#8a94a8',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Topics */}
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#505a6e',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>Topics</div>
          {Object.entries(TOPICS).map(([key, { label, color }]) => {
            const active = topic === key;
            return (
              <button key={key} onClick={() => handleTopicSelect(key)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 10px', borderRadius: 6, border: 'none',
                background: active ? 'rgba(79,255,176,0.07)' : 'transparent',
                color: active ? '#4fffb0' : '#8a94a8',
                cursor: 'pointer', marginBottom: 2, fontSize: 13,
                fontFamily: 'DM Sans,sans-serif', transition: 'all .15s', textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: active ? '#4fffb0' : color, flexShrink: 0,
                  }} />
                  {label}
                </div>
                <span style={{
                  fontFamily: 'IBM Plex Mono,monospace', fontSize: 10,
                  color: active ? 'rgba(79,255,176,0.6)' : '#505a6e',
                }}>
                  {counts[key] || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Range */}
        <div style={{ padding: '0 12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#505a6e',
            letterSpacing: '0.12em', textTransform: 'uppercase', margin: '12px 0 8px',
          }}>Date range</div>
          {RANGES.map(r => {
            const active = days === r.value;
            return (
              <button key={r.value} onClick={() => { onSwitchRange(r.value); onClose(); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 10px', borderRadius: 6, border: 'none',
                background: active ? 'rgba(79,255,176,0.07)' : 'transparent',
                color: active ? '#4fffb0' : '#8a94a8',
                cursor: 'pointer', marginBottom: 2, fontSize: 13,
                fontFamily: 'DM Sans,sans-serif', transition: 'all .15s', textAlign: 'left',
              }}>
                {r.label}
                {active && <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: 'rgba(79,255,176,0.6)' }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div style={{ padding: '0 12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#505a6e',
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
          }}>Sort by</div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            style={{
              width: '100%', background: '#171c27', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, color: '#dde2ed', fontFamily: 'IBM Plex Mono,monospace',
              fontSize: 16, padding: '10px 10px', outline: 'none', cursor: 'pointer',
              appearance: 'none', WebkitAppearance: 'none',
            }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}
