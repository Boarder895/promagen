import { useEffect, useRef } from 'react';

export default function StockTicker() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {}, []);
  return (
    <div
      ref={ref}
      style={{
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        border: '1px solid #eee',
        padding: '8px 12px',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      OpenAI ▲1.2 • Stability ▼0.4 • Leonardo ▲0.7 • DeepAI — •
    </div>
  );
}
