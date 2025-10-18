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
      OpenAI â–²1.2 â€¢ Stability â–¼0.4 â€¢ Leonardo â–²0.7 â€¢ DeepAI â€” â€¢
    </div>
  );
}






