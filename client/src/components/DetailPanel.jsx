import React, { useState, useEffect } from 'react';
import { TOPICS, TAG_STYLES, formatDate } from '../utils.js';

const SECTION_COLORS = { IMPACT:'#4fffb0', OPPORTUNITY:'#60a5fa', THREAT:'#f87171', WATCH:'#fbbf24' };

function parseAnalysis(text) {
  const keys = ['IMPACT', 'OPPORTUNITY', 'THREAT', 'WATCH'];
  const result = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const next = keys[i + 1];
    const start = text.indexOf(key);
    if (start === -1) continue;
    const end = next ? text.indexOf(next, start + key.length) : text.length;
    const content = text.slice(start + key.length, end).replace(/^[\s:]+/, '').trim();
    result.push({ key, content });
  }
  return result.length ? result : [{ key: 'ANALYSIS', content: text.trim() }];
}

export default function DetailPanel({ article, isStarred, onToggleStar, onClose, isMobile }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => { setCopied(false); }, [article.id]);
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  function copyLink() {
    navigator.clipboard.writeText(article.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const tag = TAG_STYLES[article.topic] || TAG_STYLES.tech;
  const topicLabel = TOPICS[article.topic]?.label || 'Technology';
  const sections = article.analysis ? parseAnalysis(article.analysis) : [];

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }}/>
      <div style={isMobile ? {
        position: 'fixed', inset: 0,
        background: '#11141c', borderTop: '1px solid rgba(255,255,255,0.12)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideUp .25s cubic-bezier(.4,0,.2,1)',
      } : {
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500, maxWidth: '100vw',
        background: '#11141c', borderLeft: '1px solid rgba(255,255,255,0.12)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        animation: 'slideIn .25s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ ...tag, fontFamily:'IBM Plex Mono,monospace', fontSize:9, padding:'3px 8px', borderRadius:3, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>{topicLabel}</span>
            <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#3b82f6' }}>{article.source}</span>
          </div>
          <button onClick={onClose} style={{ background:'#171c27', border:'1px solid rgba(255,255,255,0.07)', borderRadius:6, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#8a94a8' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, color:'#fff', lineHeight:1.35, marginBottom:10 }}>{article.title}</div>
          <div style={{ display:'flex', gap:12, marginBottom:18, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#3b82f6' }}>{article.source}</span>
            <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color:'#505a6e' }}>{formatDate(article.publishedAt || article.time)}</span>
          </div>

          {/* Summary */}
          <div style={{ background:'#171c27', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'13px 15px', marginBottom:14 }}>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#505a6e', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:7 }}>Summary</div>
            <div style={{ fontSize:13, color:'#8a94a8', lineHeight:1.65 }}>{article.summary}</div>
          </div>

          {/* AI Analysis */}
          <div style={{ background:'#171c27', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, padding:'13px 15px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:12 }}>
              <div style={{ width:6, height:6, background:'#4fffb0', borderRadius:'50%' }}/>
              <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#4fffb0', letterSpacing:'0.1em', textTransform:'uppercase' }}>AI Analysis</span>
            </div>

            {!article.analysis && (
              <div style={{ fontSize:12, color:'#505a6e', fontFamily:'IBM Plex Mono,monospace', fontStyle:'italic' }}>
                AI analysis pending — check back after the next scheduled update.
              </div>
            )}

            {sections.map(({ key, content }) => (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color: SECTION_COLORS[key] || '#4fffb0', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:5 }}>{key}</div>
                <div style={{ fontSize:13, color:'#dde2ed', lineHeight:1.7 }}>{content}</div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            <a href={article.url} target="_blank" rel="noopener noreferrer" style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              padding:'11px 16px', borderRadius:8, fontSize:13, fontFamily:'IBM Plex Mono,monospace',
              background:'rgba(79,255,176,0.08)', color:'#4fffb0', border:'1px solid rgba(79,255,176,0.3)',
            }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(79,255,176,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(79,255,176,0.08)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open full article
            </a>

            <button onClick={copyLink} style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              padding:'11px 16px', borderRadius:8, fontSize:13, fontFamily:'IBM Plex Mono,monospace',
              color:'#8a94a8', background:'transparent', border:'1px solid rgba(255,255,255,0.13)', cursor:'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.background='#171c27'; e.currentTarget.style.color='#dde2ed'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#8a94a8'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'13px 18px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <button onClick={onToggleStar} style={{
            display:'flex', alignItems:'center', gap:7,
            fontFamily:'IBM Plex Mono,monospace', fontSize:11, padding:'7px 14px',
            borderRadius:7, cursor:'pointer', transition:'all .15s',
            border: isStarred ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.13)',
            background: isStarred ? 'rgba(245,158,11,0.07)' : 'transparent',
            color: isStarred ? '#f59e0b' : '#8a94a8',
          }}>
            {isStarred ? '★' : '☆'} {isStarred ? 'Starred' : 'Star article'}
          </button>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#505a6e' }}>{formatDate(article.publishedAt || article.time)}</span>
        </div>
      </div>
    </>
  );
}
