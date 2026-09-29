import React, { useEffect, useState } from 'react';
import ArticleCard from './ArticleCard.jsx';

const STEPS = [
  'Scanning SecurityInfoWatch...', 'Checking IFSEC Global...',
  'Pulling vendor press releases...', 'Fetching AI & biometrics news...',
  'Checking regulatory updates...', 'Gathering market intelligence...',
  'Compiling your feed...',
];

export default function FeedPanel({ articles, loading, error, selected, isStarred, onSelect, onToggleStar, onRetry, tab, isMobile }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep(i => (i + 1) % STEPS.length), 1400);
    return () => clearInterval(t);
  }, [loading]);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '12px 10px 68px' : '12px 16px' }}>

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:14 }}>
            <div style={{ width:28, height:28, border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'#4fffb0', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#505a6e' }}>SCANNING SOURCES</div>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'rgba(79,255,176,0.6)' }}>{STEPS[step]}</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:24, textAlign:'center', margin:'20px 0' }}>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:13, color:'#f87171', marginBottom:10 }}>Failed to load news</div>
            <div style={{ fontSize:12, color:'#8a94a8', marginBottom:16 }}>{error}</div>
            <button onClick={onRetry} style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, padding:'8px 16px', borderRadius:7, border:'1px solid rgba(239,68,68,0.3)', background:'rgba(239,68,68,0.08)', color:'#f87171', cursor:'pointer' }}>
              ↻ Retry
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'80px 20px', gap:10, color:'#505a6e' }}>
            <div style={{ fontSize:28, opacity:0.4 }}>{tab === 'starred' ? '☆' : '◫'}</div>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:12 }}>
              {tab === 'starred' ? 'Star articles to save them here.' : 'No articles match your filters.'}
            </div>
          </div>
        )}

        {!loading && articles.map(a => (
          <ArticleCard
            key={a.id}
            article={a}
            selected={selected?.id === a.id}
            isStarred={isStarred(a.id)}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
    </div>
  );
}
