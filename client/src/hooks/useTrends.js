import { useState, useCallback } from 'react';

const DATA_URL = `${import.meta.env.BASE_URL}data/trends.json`;

export function useTrends() {
  const [trends, setTrends]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);

  const fetchTrends = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? `${DATA_URL}?t=${Date.now()}` : DATA_URL;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      setLastRunAt(data.lastRunAt || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const load    = useCallback(() => fetchTrends(false), [fetchTrends]);
  const refresh = useCallback(() => fetchTrends(true), [fetchTrends]);

  return { trends, loading, error, lastRunAt, load, refresh };
}
