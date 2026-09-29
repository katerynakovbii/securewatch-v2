import React, { useMemo, useState } from 'react';
import TrendCard from './TrendCard.jsx';

function parseDate(str) { return str ? (new Date(str).getTime() || 0) : 0; }

export default function TrendsPanel({ trends, loading, error, lastRunAt, onRetry, isMobile }) {
  const [showArchive, setShowArchive] = useState(false);

  const active = useMemo(
    () => trends.filter(t => t.status !== 'cooled').sort((a, b) => parseDate(b.lastActive) - parseDate(a.lastActive)),
    [trends]
  );
  const archived = useMemo(
    () => trends.filter(t => t.status === 'cooled').sort((a, b) => parseDate(b.cooledAt) - parseDate(a.cooledAt)),
    [trends]
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '12px 10px 68px' : '12px 16px' }}>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 14 }}>
            <div style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#4fffb0', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, color: '#505a6e' }}>LOADING TRENDS</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 24, textAlign: 'center', margin: '20px 0' }}>
            <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 13, color: '#f87171', marginBottom: 10 }}>Failed to load trends</div>
            <div style={{ fontSize: 12, color: '#8a94a8', marginBottom: 16 }}>{error}</div>
            {onRetry && (
              <button onClick={onRetry} style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 11, padding: '8px 16px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer' }}>
                ↻ Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {lastRunAt && (
              <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e', marginBottom: 14 }}>
                Last analyzed {new Date(lastRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}

            {active.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 20px', gap: 10, color: '#505a6e' }}>
                <div style={{ fontSize: 28, opacity: 0.4 }}>◫</div>
                <div style={{ fontFamily: 'IBM Plex Mono,monospace', fontSize: 12 }}>No active trends detected yet.</div>
              </div>
            )}

            {active.map(t => <TrendCard key={t.id} trend={t} />)}

            {archived.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <button onClick={() => setShowArchive(s => !s)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.07)',
                  padding: '12px 0 10px', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono,monospace', fontSize: 10, color: '#505a6e',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {showArchive ? '▴' : '▾'} Archive ({archived.length})
                </button>
                {showArchive && archived.map(t => <TrendCard key={t.id} trend={t} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
