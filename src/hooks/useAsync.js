import { useCallback, useEffect, useRef, useState } from "react";

// Виконує асинхронний запит до API і повертає { data, loading, error, reload }.
// Стан «loading» дозволяє показати індикатор, а «error» – зрозуміле повідомлення про помилку.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const counter = useRef(0);

  const run = useCallback(() => {
    const id = ++counter.current; // ігноруємо застарілі відповіді
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => id === counter.current && setState({ data, loading: false, error: null }))
      .catch((error) => id === counter.current && setState({ data: null, loading: false, error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
