import type { Exchange } from "@/data/exchanges";

export default function ExchangeCard({ exchange }: { exchange: Exchange }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs opacity-60">{exchange.id?.toUpperCase()}</div>
      <div className="text-lg font-semibold">{exchange.name}</div>
      {exchange.city ? (
        <div className="text-sm opacity-70">{exchange.city}</div>
      ) : null}
    </div>
  );
}

