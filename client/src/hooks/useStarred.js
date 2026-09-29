import { useState, useCallback } from 'react';

const KEY = 'sw_starred_v3'; // v3 = URL-keyed, persistent across refreshes

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); }
  catch { return new Set(); }
}

export function useStarred() {
  const [starred, setStarred] = useState(load);

  // key = article.url (stable across fetches)
  const toggle = useCallback((url) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      localStorage.setItem(KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isStarred = useCallback((url) => starred.has(url), [starred]);

  return { starred, toggle, isStarred };
}
