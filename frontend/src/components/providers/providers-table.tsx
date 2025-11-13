import React from "react";
import type { Provider } from "@/types/provider";

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;
  title?: string;
  caption?: string;
  limit?: number; // default 20
  showRank?: boolean; // default true
};

function trendLabel(t?: Provider["trend"]): string {
  if (t === "up") return "Trending up";
  if (t === "down") return "Trending down";
  return "No change";
}

export default function ProvidersTable(props: ProvidersTableProps): JSX.Element {
  const {
    providers,
    title = "AI Providers",
    caption = "Top providers ranked by Promagen score.",
    limit = 20,
    showRank = true,
  } = props;

  const rows = providers.slice(0, Math.max(0, limit));

  return (
    <section aria-labelledby="providers-heading" data-testid="providers-table">
      <h1 id="providers-heading" className="text-xl font-semibold mb-3">
        {title}
      </h1>

      <div className="overflow-x-auto rounded-2xl shadow-sm ring-1 ring-white/10">
        <table role="table" className="min-w-full divide-y divide-white/10 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-white/5">
            <tr>
              {showRank && (
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  #
                </th>
              )}
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Provider
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Score
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Trend
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((p, i) => (
              <tr key={p.id}>
                {showRank && (
                  <th scope="row" className="px-3 py-2 font-normal text-white/70">
                    {i + 1}
                  </th>
                )}
                <td className="px-3 py-2">
                  {p.url ? (
                    <a
                      href={p.url}
                      className="underline underline-offset-2 hover:text-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.name}
                    </a>
                  ) : (
                    p.name
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums">{p.score ?? "—"}</td>
                <td className="px-3 py-2" aria-label={trendLabel(p.trend)}>
                  {p.trend === "up" ? "📈" : p.trend === "down" ? "📉" : "⟷"}
                </td>
                <td className="px-3 py-2">
                  {p.tags && p.tags.length > 0 ? (
                    <ul className="flex gap-2 flex-wrap">
                      {p.tags.map((t) => (
                        <li
                          key={t}
                          className="rounded-full px-2 py-0.5 text-xs bg-white/10 text-white/80"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-white/50">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
