export const TOPICS = {
  all:        { label: 'All articles',        color: '#6b7280' },
  physical:   { label: 'Physical Security',   color: '#4fffb0' },
  ai:         { label: 'AI & Analytics',      color: '#60a5fa' },
  video:      { label: 'Video Surveillance',  color: '#34d399' },
  access:     { label: 'Access Control',      color: '#a78bfa' },
  cyber:      { label: 'Cybersecurity',       color: '#f97316' },
  cloud:      { label: 'Cloud & SaaS',        color: '#22d3ee' },
  integration:{ label: 'Integrations & API',  color: '#e879f9' },
  building:   { label: 'Smart Buildings',     color: '#84cc16' },
  regulation: { label: 'Compliance & Standards', color: '#f87171' },
  business:   { label: 'M&A / Business',      color: '#fbbf24' },
  tech:       { label: 'Technology',          color: '#94a3b8' },
};

export const TAG_STYLES = {
  ai:          { background:'rgba(37,99,235,0.15)',   color:'#60a5fa', border:'1px solid rgba(37,99,235,0.25)'   },
  video:       { background:'rgba(16,185,129,0.12)',  color:'#34d399', border:'1px solid rgba(16,185,129,0.2)'   },
  access:      { background:'rgba(139,92,246,0.12)',  color:'#a78bfa', border:'1px solid rgba(139,92,246,0.2)'   },
  cyber:       { background:'rgba(249,115,22,0.12)',  color:'#f97316', border:'1px solid rgba(249,115,22,0.25)'  },
  cloud:       { background:'rgba(34,211,238,0.1)',   color:'#22d3ee', border:'1px solid rgba(34,211,238,0.2)'   },
  integration: { background:'rgba(232,121,249,0.1)',  color:'#e879f9', border:'1px solid rgba(232,121,249,0.2)'  },
  building:    { background:'rgba(132,204,22,0.1)',   color:'#84cc16', border:'1px solid rgba(132,204,22,0.2)'   },
  business:    { background:'rgba(245,158,11,0.12)',  color:'#fbbf24', border:'1px solid rgba(245,158,11,0.2)'   },
  regulation:  { background:'rgba(239,68,68,0.1)',    color:'#f87171', border:'1px solid rgba(239,68,68,0.2)'    },
  tech:        { background:'rgba(100,116,139,0.15)', color:'#94a3b8', border:'1px solid rgba(100,116,139,0.2)'  },
};

export const PHYSICAL_BADGE_STYLE = { background:'rgba(79,255,176,0.08)', color:'#4fffb0', border:'1px solid rgba(79,255,176,0.25)' };

export const SORT_OPTIONS = [
  { value: 'newest',  label: 'Newest first'  },
  { value: 'oldest',  label: 'Oldest first'  },
  { value: 'topic',   label: 'By topic'      },
  { value: 'source',  label: 'By source'     },
];

function parseDate(str) {
  if (!str) return 0;
  const direct = Date.parse(str);
  if (!isNaN(direct)) return direct;
  const now = Date.now();
  const s = str.toLowerCase().trim();
  if (s === 'today' || s === 'just now') return now;
  const m = s.match(/(\d+)\s+(minute|hour|day|week|month)s?\s+ago/);
  if (m) {
    const n = parseInt(m[1]);
    const unit = m[2];
    const ms = { minute: 60000, hour: 3600000, day: 86400000, week: 604800000, month: 2592000000 };
    return now - n * (ms[unit] || 0);
  }
  return 0;
}

export function formatDate(str) {
  if (!str) return '';
  const ts = parseDate(str);
  if (!ts) return str;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sortArticles(articles, sortBy) {
  const copy = [...articles];
  if (sortBy === 'newest') return copy.sort((a, b) => parseDate(b.publishedAt) - parseDate(a.publishedAt));
  if (sortBy === 'oldest') return copy.sort((a, b) => parseDate(a.publishedAt) - parseDate(b.publishedAt));
  if (sortBy === 'topic')  return copy.sort((a, b) => (a.topic||'').localeCompare(b.topic||''));
  if (sortBy === 'source') return copy.sort((a, b) => (a.source||'').localeCompare(b.source||''));
  return copy;
}

export function filterArticles(articles, { topic, query }) {
  return articles.filter(a => {
    const matchTopic = !topic || topic === 'all' ||
      (topic === 'physical' ? a.physical === true : a.topic === topic);
    const q = (query || '').toLowerCase();
    const matchQuery = !q ||
      a.title.toLowerCase().includes(q) ||
      (a.summary || '').toLowerCase().includes(q) ||
      a.source.toLowerCase().includes(q);
    return matchTopic && matchQuery;
  });
}

export function topicCounts(articles) {
  const counts = { all: articles.length };
  for (const t of Object.keys(TOPICS)) if (t !== 'all') counts[t] = 0;
  for (const a of articles) {
    const t = a.topic || 'tech';
    counts[t] = (counts[t] || 0) + 1;
  }
  counts.physical = articles.filter(a => a.physical === true).length;
  return counts;
}
