import React from 'react';

function NavBtn({ active, onClick, label, badge, dot, children, ...rest }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      {...rest}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, background: 'none', border: 'none',
        cursor: 'pointer', padding: '6px 0', position: 'relative',
        color: active ? '#4fffb0' : '#505a6e', transition: 'color .15s',
      }}
    >
      {children}
      <span style={{
        fontFamily: 'IBM Plex Mono,monospace', fontSize: 9,
        letterSpacing: '0.05em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {badge != null && (
        <span data-testid="star-badge" style={{
          position: 'absolute', top: 4, right: 'calc(50% - 20px)',
          minWidth: 16, height: 16, background: '#f59e0b', color: '#000',
          fontSize: 9, fontWeight: 600, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', whiteSpace: 'nowrap',
        }}>{badge}</span>
      )}
      {dot && (
        <span data-testid="filter-dot" style={{
          position: 'absolute', top: 6, right: 'calc(50% - 20px)',
          width: 6, height: 6, background: '#4fffb0', borderRadius: '50%',
        }} />
      )}
    </button>
  );
}

export default function MobileBottomNav({ tab, setTab, starCount, filterDrawerOpen, setFilterDrawerOpen, hasActiveFilter }) {
  function handleFeed() { setTab('feed'); setFilterDrawerOpen(false); }
  function handleStarred() { setTab('starred'); setFilterDrawerOpen(false); }
  function handleFilter() { setFilterDrawerOpen(!filterDrawerOpen); }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 56,
      background: '#11141c', borderTop: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'stretch', zIndex: 300,
    }}>
      <NavBtn active={tab === 'feed' && !filterDrawerOpen} onClick={handleFeed} label="Feed">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h12" />
        </svg>
      </NavBtn>

      <NavBtn active={filterDrawerOpen} onClick={handleFilter} label="Filter" dot={hasActiveFilter} aria-expanded={filterDrawerOpen}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      </NavBtn>

      <NavBtn
        active={tab === 'starred' && !filterDrawerOpen}
        onClick={handleStarred}
        label="Starred"
        badge={starCount > 0 ? starCount : null}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </NavBtn>
    </div>
  );
}
