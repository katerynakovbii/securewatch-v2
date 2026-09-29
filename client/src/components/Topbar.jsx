import React, { useState } from 'react';

const ShieldIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <text x="12" y="16" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="700" fontFamily="IBM Plex Mono, monospace">i</text>
  </svg>
);

const RANGES = [
  { value: 1,  label: 'Today only' },
  { value: 2,  label: 'Last 2 days' },
  { value: 3,  label: 'Last 3 days' },
  { value: 7,  label: 'Last 7 days' },
  { value: 14, label: 'Last 2 weeks' },
  { value: 30, label: 'Last 30 days' },
];

export default function Topbar({ tab, setTab, starCount, fetchedAt, loading, days, onRefresh, onSwitchRange, query, setQuery, isMobile }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSearch, setShowSearch]     = useState(false);

  const ts = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const selectedLabel = RANGES.find(r => r.value === days)?.label || 'Last 7 days';

  function handleRangeSelect(val) {
    setShowDropdown(false);
    onSwitchRange(val);
  }

  function handleRefresh() {
    setShowDropdown(false);
    onRefresh(days);
  }

  if (isMobile) {
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 14px', height: 52, background: '#11141c',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, background: '#00CC92', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldIcon />
            </div>
            <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>SecureWatch</span>
          </div>

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Refresh */}
            <button
              onClick={() => onRefresh(days)}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 7, width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: loading ? '#4fffb0' : '#8a94a8',
                opacity: loading ? 1 : 0.8,
              }}
            >
              <span style={{ display: 'inline-block', fontSize: 16, animation: loading ? 'spin .7s linear infinite' : 'none' }}>↻</span>
            </button>

            {/* Search toggle */}
            <button
              onClick={() => setShowSearch(s => !s)}
              style={{
                background: 'transparent',
                border: `1px solid ${showSearch ? 'rgba(79,255,176,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 7, width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: showSearch ? '#4fffb0' : '#8a94a8',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </button>

          </div>
        </div>

        {/* Expandable search bar */}
        {showSearch && (
          <div style={{
            position: 'absolute', top: 52, left: 0, right: 0,
            background: '#11141c', borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: '8px 14px', zIndex: 100,
          }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#505a6e', pointerEvents: 'none' }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search articles, sources..."
                style={{
                  background: '#171c27', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '9px 12px 9px 34px',
                  fontFamily: 'DM Sans,sans-serif', fontSize: 16,
                  color: '#dde2ed', outline: 'none', width: '100%',
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px', height: 52, background: '#11141c',
      borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, gap: 12,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, background: '#00CC92', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldIcon />
        </div>
        <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>SecureWatch</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#171c27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 3 }}>
        {['feed', 'starred', 'trends'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, padding: '6px 16px',
            borderRadius: 5, border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
            background: tab === t ? '#1d2333' : 'transparent',
            color: tab === t ? '#dde2ed' : '#505a6e',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'starred' && starCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, background: '#f59e0b', color: '#000', fontSize: 9, fontWeight: 500, borderRadius: '50%' }}>
                {starCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#505a6e', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles, sources..."
            style={{
              background: '#171c27', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,
              padding: '7px 12px 7px 34px', fontFamily: 'DM Sans,sans-serif', fontSize: 13,
              color: '#dde2ed', outline: 'none', width: 220,
            }} />
        </div>

        {ts && <span style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e' }}>{ts}</span>}

        {/* Split refresh + date range */}
        <div style={{ position: 'relative', display: 'flex' }}>
          <button onClick={handleRefresh} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, padding: '7px 12px',
            borderRadius: '8px 0 0 8px', border: '1px solid rgba(79,255,176,0.3)', borderRight: 'none',
            background: 'rgba(79,255,176,0.06)', color: '#4fffb0',
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
          }}>
            <span style={{ display: 'inline-block', animation: loading ? 'spin .7s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Fetching...' : `Refresh · ${selectedLabel}`}
          </button>
          <button onClick={() => setShowDropdown(d => !d)} disabled={loading} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px 8px',
            borderRadius: '0 8px 8px 0', border: '1px solid rgba(79,255,176,0.3)',
            background: 'rgba(79,255,176,0.06)', color: '#4fffb0',
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: 10,
          }}>▾</button>

          {showDropdown && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#1d2333', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, overflow: 'hidden', zIndex: 999,
              minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '8px 14px 6px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#505a6e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Switch range
              </div>
              {RANGES.map(r => (
                <button key={r.value} onClick={() => handleRangeSelect(r.value)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                  border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono,monospace', fontSize: 11,
                  background: days === r.value ? 'rgba(79,255,176,0.1)' : 'transparent',
                  color: days === r.value ? '#4fffb0' : '#8a94a8',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,255,176,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = days === r.value ? 'rgba(79,255,176,0.1)' : 'transparent'}
                >
                  {days === r.value ? '✓ ' : '  '}{r.label}
                </button>
              ))}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '6px 14px 8px', fontFamily: 'IBM Plex Mono,monospace', fontSize: 9, color: '#505a6e' }}>
                ↻ Refresh forces new fetch
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
