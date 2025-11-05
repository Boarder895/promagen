"use client";
import { useEffect, useRef, useState } from "react";

type Props = { periodMinutes?: number };

/**
 * Fires a short "active" pulse on mount and then every `periodMinutes`.
 * Dependency-free, browser-safe (guards the timer on unmount).
 */
export default function Heartbeat({ periodMinutes = 3 }: Props) {
  const [active, setActive] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const periodMs = Math.max(1, periodMinutes) * 60_000;

    const fire = () => {
      setActive(true);
      // brief glow
      timeoutRef.current = window.setTimeout(() => setActive(false), 3000);
    };

    fire(); // on mount
    intervalRef.current = window.setInterval(fire, periodMs);

    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [periodMinutes]);

  return <div className={`heartbeat-line ${active ? "active" : ""}`} />;
}



