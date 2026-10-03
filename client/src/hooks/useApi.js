import { useState, useCallback, useRef } from 'react';

const DATA_URL = `${import.meta.env.BASE_URL}data/articles.json`;
const VALID_RANGES = [1, 2, 3, 7, 14, 30];
const DAY_MS = 86400000;

export function useNews() {
  // Full article list from the last successful fetch, unfiltered by range.
  const allRef = useRef([]);

  const [days, setDays] = useState(() => {
    const saved = parseInt(localStorage.getItem('sw_days'), 10);
    return VALID_RANGES.includes(saved) ? saved : 7;
  });
  const [articles, setArticles]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  function applyRange(d) {
    const cutoff = Date.now() - d * DAY_MS;
    setArticles(allRef.current.filter(a => {
      // Undated articles can't be shown as current in any range.
      if (!a.publishedAt) return false;
      const t = new Date(a.publishedAt).getTime();
      return !isNaN(t) && t >= cutoff;
    }));
  }

  const fetchNews = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allRef.current = data.articles || [];
      setFetchedAt(data.fetchedAt || null);
      applyRange(days);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const load    = useCallback(() => fetchNews(false), [fetchNews]);
  const refresh = useCallback(() => fetchNews(true), [fetchNews]);

  const switchRange = useCallback((d) => {
    localStorage.setItem('sw_days', d);
    setDays(d);
    applyRange(d);
  }, []);

  return { articles, loading, error, fetchedAt, days, load, refresh, switchRange };
}
