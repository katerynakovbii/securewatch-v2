import { useState, useCallback } from 'react';

const DATA_BASE = `${import.meta.env.BASE_URL}data/`;

export function useTrends(file = 'trends.json') {
  const [trends, setTrends]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastRunAt, setLastRunAt] = useState(null);

  const dataUrl = `${DATA_BASE}${file}`;

  const fetchTrends = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? `${dataUrl}?t=${Date.now()}` : dataUrl;
      const res = await fetch(url);
      // A trend archive that hasn't been generated yet is empty, not broken.
      if (res.status === 404) {
        setTrends([]);
        setLastRunAt(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTrends(data.trends || []);
      setLastRunAt(data.lastRunAt || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [dataUrl]);

  const load    = useCallback(() => fetchTrends(false), [fetchTrends]);
  const refresh = useCallback(() => fetchTrends(true), [fetchTrends]);

  return { trends, loading, error, lastRunAt, load, refresh };
}
