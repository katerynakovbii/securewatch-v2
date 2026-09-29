import React, { useState, useEffect, useMemo } from 'react';
import Topbar from './components/Topbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import FeedPanel from './components/FeedPanel.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import MobileBottomNav from './components/MobileBottomNav.jsx';
import FilterDrawer from './components/FilterDrawer.jsx';
import TrendsPanel from './components/TrendsPanel.jsx';
import { useNews } from './hooks/useApi.js';
import { useTrends } from './hooks/useTrends.js';
import { useStarred } from './hooks/useStarred.js';
import { useMobile } from './hooks/useMobile.js';
import { filterArticles, sortArticles, topicCounts } from './utils.js';

export default function App() {
  const { articles, loading, error, fetchedAt, days, load, refresh, switchRange } = useNews();
  const { trends, loading: trendsLoading, error: trendsError, lastRunAt, load: loadTrends } = useTrends();
  const { starred, toggle, isStarred } = useStarred();
  const isMobile = useMobile();

  const [tab, setTab]                           = useState('feed');
  const [topic, setTopic]                       = useState('all');
  const [sort, setSort]                         = useState('newest');
  const [query, setQuery]                       = useState('');
  const [selected, setSelected]                 = useState(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  useEffect(() => { load(); loadTrends(); }, []);
  useEffect(() => { if (!isMobile) setFilterDrawerOpen(false); }, [isMobile]);

  const pool = tab === 'starred'
    ? articles.filter(a => isStarred(a.url))
    : articles;

  const displayed = useMemo(
    () => sortArticles(filterArticles(pool, { topic, query }), sort),
    [pool, topic, query, sort]
  );

  const counts = useMemo(() => topicCounts(articles), [articles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      <Topbar
        tab={tab} setTab={setTab}
        starCount={starred.size}
        fetchedAt={fetchedAt}
        loading={loading}
        days={days}
        onRefresh={refresh}
        onSwitchRange={switchRange}
        query={query} setQuery={setQuery}
        isMobile={isMobile}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {tab === 'trends' ? (
          <TrendsPanel
            trends={trends}
            loading={trendsLoading}
            error={trendsError}
            lastRunAt={lastRunAt}
            onRetry={loadTrends}
            isMobile={isMobile}
          />
        ) : (
          <>
            {!isMobile && (
              <Sidebar
                topic={topic} setTopic={setTopic}
                sort={sort} setSort={setSort}
                counts={counts}
                totalSources={new Set(articles.map(a => a.source)).size}
                starCount={starred.size}
              />
            )}
            <FeedPanel
              articles={displayed}
              loading={loading}
              error={error}
              selected={selected}
              isStarred={isStarred}
              onSelect={setSelected}
              onToggleStar={toggle}
              onRetry={load}
              tab={tab}
              isMobile={isMobile}
            />
          </>
        )}
      </div>
      {selected && (
        <DetailPanel
          article={selected}
          isStarred={isStarred(selected.url)}
          onToggleStar={() => toggle(selected.url)}
          onClose={() => setSelected(null)}
          isMobile={isMobile}
        />
      )}
      {isMobile && (
        <>
          <MobileBottomNav
            tab={tab} setTab={setTab}
            starCount={starred.size}
            filterDrawerOpen={filterDrawerOpen}
            setFilterDrawerOpen={setFilterDrawerOpen}
            hasActiveFilter={topic !== 'all' || sort !== 'newest' || days !== 7}
          />
          <FilterDrawer
            open={filterDrawerOpen}
            onClose={() => setFilterDrawerOpen(false)}
            topic={topic} setTopic={setTopic}
            sort={sort} setSort={setSort}
            counts={counts}
            days={days} onSwitchRange={switchRange}
          />
        </>
      )}
    </div>
  );
}
