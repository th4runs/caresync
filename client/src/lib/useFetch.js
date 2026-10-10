import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Loads a GET endpoint. Returns { data, loading, error, reload, setData }. */
export function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      if (!url) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        setData(await api.get(url));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: () => load(true), setData };
}

export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
