type Props = { rank: number; name: string; score: number; delta?: number };

export default function ProviderCard({ rank, name, score, delta = 0 }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr 80px 80px',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,.08)',
        marginBottom: 10,
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: 6, background: '#ddd' }} />
      <div>
        <strong>
          {rank}. {name}
        </strong>
      </div>
      <div style={{ textAlign: 'right' }}>{score.toFixed(1)}</div>
      <div style={{ textAlign: 'right' }}>
        {delta >= 0 ? `▲ ${delta.toFixed(1)}` : `▼ ${Math.abs(delta).toFixed(1)}`}
      </div>
    </div>
  );
}
