type ExchangeMin = { id: string; name: string; city?: string; tz?: string };

export default function ExchangeCard({ exchange }: { exchange: ExchangeMin }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs opacity-60">{exchange.id?.toUpperCase()}</div>
      <div className="text-lg font-semibold">{exchange.name}</div>
      {exchange.city ? <div className="text-sm opacity-70">{exchange.city}</div> : null}
    </div>
  );
}
