import * as React from "react";
import ProviderCard from "@/components/providers/provider-card";
import type { Provider } from "@/types/provider";

type Props = { providers: Provider[] };

export default function ProviderGrid({ providers }: Props) {
  const sorted = React.useMemo(
    () =>
      [...providers].sort((a, b) => {
        const sa = typeof a.score === "number" ? a.score : 0;
        const sb = typeof b.score === "number" ? b.score : 0;
        return sb - sa || a.name.localeCompare(b.name);
      }),
    [providers]
  );

  return (
    <section role="region" aria-label="AI providers" data-testid="providers-grid">
      <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sorted.map((p, i) => (
          <li key={p.id}>
            {/* Pass rank as its own prop; do NOT inject rank into the provider object. */}
            <ProviderCard provider={p} rank={i + 1} />
          </li>
        ))}
      </ul>
    </section>
  );
}
