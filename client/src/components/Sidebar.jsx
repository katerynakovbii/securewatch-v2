import React from 'react';
import { TOPICS, SORT_OPTIONS } from '../utils.js';

export default function Sidebar({ topic, setTopic, sort, setSort, counts, totalSources, starCount }) {
  return (
    <div style={{ width:220, background:'#11141c', borderRight:'1px solid rgba(255,255,255,0.07)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>

      {/* Topics */}
      <div style={{ padding:'14px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#505a6e', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>Topics</div>
        {Object.entries(TOPICS).map(([key, { label, color }]) => {
          const active = topic === key;
          return (
            <button key={key} onClick={() => setTopic(key)} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              width:'100%', padding:'7px 10px', borderRadius:6, border:'none',
              background: active ? 'rgba(79,255,176,0.07)' : 'transparent',
              color: active ? '#4fffb0' : '#8a94a8',
              cursor:'pointer', marginBottom:2, fontSize:12,
              fontFamily:'DM Sans,sans-serif', transition:'all .15s', textAlign:'left',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background: active ? '#4fffb0' : color, flexShrink:0 }}/>
                {label}
              </div>
              <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:10, color: active ? 'rgba(79,255,176,0.6)' : '#505a6e' }}>
                {counts[key] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort */}
      <div style={{ padding:'14px 12px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#505a6e', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:8 }}>Sort by</div>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{
          width:'100%', background:'#171c27', border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:6, color:'#dde2ed', fontFamily:'IBM Plex Mono,monospace',
          fontSize:11, padding:'7px 10px', outline:'none', cursor:'pointer',
          appearance:'none', WebkitAppearance:'none',
        }}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:12, marginTop:'auto' }}>
        {[
          { n: counts.all || 0, l: 'Articles' },
          { n: totalSources,    l: 'Sources'  },
          { n: starCount,       l: 'Starred'  },
          { n: Object.keys(TOPICS).length - 1, l: 'Topics' },
        ].map(({ n, l }) => (
          <div key={l} style={{ background:'#171c27', borderRadius:7, padding:10 }}>
            <div style={{ fontFamily:'Syne,sans-serif', fontSize:20, fontWeight:700, color:'#fff', lineHeight:1 }}>{n}</div>
            <div style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:9, color:'#505a6e', marginTop:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
