import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'signal-horizon:soc-watchlist';

function loadWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useSocWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>(() => loadWatchlist());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  const isWatched = useCallback((actorId: string) => watchlist.includes(actorId), [watchlist]);

  const toggleWatch = useCallback((actorId: string) => {
    setWatchlist((prev) =>
      prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]
    );
  }, []);

  const value = useMemo(() => ({ watchlist, isWatched, toggleWatch }), [watchlist, isWatched, toggleWatch]);
  return value;
}
