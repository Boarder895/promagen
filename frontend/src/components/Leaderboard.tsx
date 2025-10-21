// If you already moved PROVIDERS to src/data/providers, import from there:
import { PROVIDERS } from "@/data/providers";

export default function Leaderboard() {
  return (
    <div className="leaderboard">
      <div className="lb-grid">
        {PROVIDERS.map((p, i) => (
          <div key={p.id} className={`lb-tile ${i < 10 ? "featured" : ""}`} title={p.tagline}>
            <div className="lb-top">{p.name}</div>
            <div className="lb-tagline">{p.tagline}</div>
            <div className="lb-row">
              <div className="lb-score">92 ▲</div>
              <div className="lb-cta">
                <a href={p.affiliateUrl ?? p.website} target="_blank">Visit</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

