export const dynamic = "force-dynamic";

type Row = {
  rank: number; rankDelta: number; symbol: string; name: string;
  score: number; changeAbs: number; changePct: number; volume: number;
  high24: number; low24: number; badges: string[]; url: string;
};

type Market = {
  code: string; name: string; tz: string; open: boolean;
  localTime: string; nextEvent: string; hours: { open: string; close: string };
};

type IGItem = { symbol: string; name: string; tagline: string; prompts: string[]; url: string };

import Ticker from "./Ticker";
import CopyButton from "./CopyButton";

async function getJSON<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function MarketPage() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";
  const [{ rows }, { markets }, { items }] = await Promise.all([
    getJSON<{ rows: Row[] }>("/api/v1/leaderboard/top"),
    getJSON<{ markets: Market[] }>("/api/v1/markets/status"),
    getJSON<{ items: IGItem[] }>("/api/v1/ig"),
  ]);

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Promagen Market</h1>

      {/* Ticker (client component) */}
      <Ticker base={base} />

      {/* Board */}
      <section className="rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th><Th>Î”</Th><Th>Symbol</Th><Th>Name</Th>
              <Th className="text-right">Score</Th>
              <Th className="text-right">Î”</Th>
              <Th className="text-right">Î”%</Th>
              <Th className="text-right">Vol</Th>
              <Th className="text-right">High</Th>
              <Th className="text-right">Low</Th>
              <Th>Badges</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.symbol} className="border-t">
                <Td>{r.rank}</Td>
                <Td>{r.rankDelta > 0 ? `â–²${r.rankDelta}` : r.rankDelta < 0 ? `â–¼${Math.abs(r.rankDelta)}` : "â€”"}</Td>
                <Td><a className="underline" href={r.url} target="_blank">{r.symbol}</a></Td>
                <Td>{r.name}</Td>
                <Td className="text-right font-medium">{r.score.toFixed(2)}</Td>
                <Td className={`text-right ${r.changeAbs>=0 ? "text-green-600" : "text-red-600"}`}>{r.changeAbs>=0?"+":""}{r.changeAbs.toFixed(2)}</Td>
                <Td className={`text-right ${r.changePct>=0 ? "text-green-600" : "text-red-600"}`}>{r.changePct>=0?"+":""}{r.changePct.toFixed(2)}%</Td>
                <Td className="text-right">{r.volume.toLocaleString()}</Td>
                <Td className="text-right">{r.high24.toFixed(2)}</Td>
                <Td className="text-right">{r.low24.toFixed(2)}</Td>
                <Td>{r.badges?.length ? r.badges.join(" â€¢ ") : "â€”"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Markets rail */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Markets</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {markets.map(m => (
            <div key={m.code} className="border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{m.code}</div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${m.open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                  {m.open ? "OPEN" : "CLOSED"}
                </span>
              </div>
              <div className="text-sm opacity-70">{m.name}</div>
              <div className="text-sm mt-1">Local time: <b>{m.localTime}</b></div>
              <div className="text-xs opacity-70">Hours: {m.hours.open}â€“{m.hours.close} ({m.tz})</div>
              <div className="text-xs mt-1">{m.nextEvent}</div>
            </div>
          ))}
        </div>
      </section>

      {/* IG section */}
      <section className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-3">IG Picks & Helpful Prompts</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(x => (
            <article key={x.symbol} className="border rounded-xl p-3">
              <div className="text-sm opacity-70">{x.symbol}</div>
              <div className="font-semibold"><a className="underline" href={x.url} target="_blank">{x.name}</a></div>
              <p className="text-sm mt-1">{x.tagline}</p>
              <ul className="mt-2 space-y-1">
                {x.prompts.map((p, i) => (
                  <li key={i} className="text-sm">
                    <CopyButton text={p} /> {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Th(props: React.PropsWithChildren<{ className?: string }>) {
  return <th className={`text-left font-semibold px-3 py-2 ${props.className ?? ""}`}>{props.children}</th>;
}
function Td(props: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-3 py-2 ${props.className ?? ""}`}>{props.children}</td>;
}

