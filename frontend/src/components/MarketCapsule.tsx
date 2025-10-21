"use client";
import type { ExchangeInfo, MarketState, Weather } from "@/types/ribbon";

type Props = {
  exchange: ExchangeInfo;
  state?: MarketState;
  weather?: Pick<Weather, "tempC" | "condition" | "city">;
  quote?: { last: number; prevClose: number; changePts: number; changePct: number } | null;
};

function WeatherGlyph({ condition }: { condition?: Weather["condition"] }) {
  const map: Record<string, string> = { clear: "??", cloudy: "??", rain: "???", snow: "??", fog: "???", wind: "???", storm: "??" };
  return <span className="weather">{map[(condition ?? "cloudy") as keyof typeof map]}</span>;
}

export default function MarketCapsule({ exchange, state, weather, quote }: Props) {
  const open = state?.status === "open";
  const nowLocal = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: exchange.tz }).format(new Date());
  const tzShort = exchange.tz.split("/").pop() ?? exchange.tz;

  const deltaClass = quote && quote.changePts >= 0 ? "up" : "down";

  return (
    <div className={`market-card ${open ? "open" : ""}`}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700 }}>{exchange.city}</div>
          <div className="badge">{exchange.exchange}</div>
        </div>
        <div className="row">
          <WeatherGlyph condition={weather?.condition} />
          <div className="temp">{Math.round(weather?.tempC ?? 18)}°C</div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="muted">{nowLocal} ({tzShort})</div>
        <div className="badge">{open ? "OPEN" : "CLOSED"}</div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{quote ? quote.last.toLocaleString() : "—"}</div>
          <div className="muted" style={{ fontSize: 12 }}>Prev {quote ? quote.prevClose.toLocaleString() : "—"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={deltaClass} style={{ fontWeight: 700 }}>
            {quote ? (quote.changePts >= 0 ? "?" : "?") : ""} {quote ? quote.changePts.toFixed(0) : "—"} pts
          </div>
          <div className="muted" style={{ fontSize: 12 }}>{quote ? quote.changePct.toFixed(2) : "—"}%</div>
        </div>
      </div>

      <style jsx>{`
        .market-card{border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(255,255,255,.04);padding:12px}
        .row{display:flex;align-items:center}
        .badge{padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:12px}
        .muted{opacity:.7}
        .up{color:#16a34a}.down{color:#dc2626}
      `}</style>
    </div>
  );
}


