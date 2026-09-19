import { useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nonce = useRef(0);

  const run = () => {
    const id = ++nonce.current;
    setLoading(true);
    setError(null);
    fn()
      .then((res) => {
        if (id === nonce.current) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (id === nonce.current) {
          const message = err instanceof ApiError ? err.message : String(err);
          setError(message);
          setLoading(false);
        }
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);

  return { data, loading, error, reload: run };
}
