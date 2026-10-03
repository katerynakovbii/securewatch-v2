import React from 'react';
import { TOPICS, TAG_STYLES, PHYSICAL_BADGE_STYLE, formatDate } from '../utils.js';

export default function ArticleCard({ article, selected, isStarred, onSelect, onToggleStar }) {
  const tag = TAG_STYLES[article.topic] || TAG_STYLES.tech;
  const label = TOPICS[article.topic]?.label || 'Technology';

  return (
    <div
      onClick={() => onSelect(article)}
      style={{
        background: selected ? 'rgba(79,255,176,0.03)' : '#11141c',
        border: `1px solid ${selected ? 'rgba(79,255,176,0.35)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius:10, padding:'14px 16px', marginBottom:8,
        display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'start',
        cursor:'pointer', transition:'border-color .15s, background .15s',
        animation:'fadeUp .2s ease both',
      }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.borderColor='rgba(255,255,255,0.13)'; e.currentTarget.style.background='#171c27'; }}}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.background='#11141c'; }}}
    >
      <div style={{ minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7, flexWrap:'wrap' }}>
          <span style={{ ...tag, fontFamily:'IBM Plex Mono,monospace', fontSize:9, padding:'3px 8px', borderRadius:3, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</span>
          {article.physical && <span style={{ ...PHYSICAL_BADGE_STYLE, fontFamily:'IBM Plex Mono,monospace', fontSize:9, padding:'3px 8px', borderRadius:3, fontWeight:500, letterSpacing:'0.05em', textTransform:'uppercase' }}>Physical</span>}
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#3b82f6' }}>{article.source}</span>
          <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#505a6e' }}>{formatDate(article.publishedAt || article.time)}</span>
        </div>
        <div style={{ fontFamily:'Syne,sans-serif', fontSize:14, fontWeight:600, color:'#fff', lineHeight:1.4, marginBottom:5 }}>{article.title}</div>
        <div style={{ fontSize:12, color:'#8a94a8', lineHeight:1.55 }}>{article.summary}</div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar(article.url); }}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:17, padding:2, color: isStarred ? '#f59e0b' : '#505a6e', lineHeight:1, transition:'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color='#f59e0b'}
          onMouseLeave={e => e.currentTarget.style.color = isStarred ? '#f59e0b' : '#505a6e'}
        >{isStarred ? '★' : '☆'}</button>

        <a href={article.url} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color:'#505a6e', display:'flex', alignItems:'center', gap:3 }}
          onMouseEnter={e => e.currentTarget.style.color='#dde2ed'}
          onMouseLeave={e => e.currentTarget.style.color='#505a6e'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open
        </a>
      </div>
    </div>
  );
}
