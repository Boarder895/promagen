import { useEffect, useRef, useState } from "react";

export function useBackoff(baseMs = 1000, maxMs = 30000) {
  const [delay, setDelay] = useState(baseMs);
  const timer = useRef<number | null>(null);
  const tick = () => {
    setDelay((d) => Math.min(d * 2, maxMs));
  };
  const reset = () => setDelay(baseMs);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return { delay, tick, reset };
}

