"use client";

import { useEffect, useRef, useState } from "react";

export default function Ticker({ base }: { base: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`${base}/api/v1/ticker/stream`);
    esRef.current = es;
    es.addEventListener("tick", (ev: MessageEvent) => {
      try {
        const t = JSON.parse((ev as any).data);
        const sign = t.changeAbs >= 0 ? "â–²" : "â–¼";
        const s = `${t.symbol} ${t.score.toFixed(2)} ${sign}${Math.abs(t.changeAbs).toFixed(2)} (${t.changePct.toFixed(2)}%) Vol ${t.volume}`;
        setLines(prev => [s, ...prev].slice(0, 12));
      } catch {}
    });
    return () => es.close();
  }, [base]);

  return (
    <div className="rounded-2xl border p-2 overflow-hidden">
      <div className="whitespace-nowrap text-sm">
        {lines.length === 0 ? <span className="opacity-60">Waiting for ticksâ€¦</span>
          : lines.map((s, i) => <span key={i} className="mr-6">{s}</span>)}
      </div>
    </div>
  );
}

