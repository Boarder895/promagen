import type { FC } from "react";
import type { z } from "zod";
import { ProvidersSchema } from "@/data/schemas";
import ProviderCard from "./provider-card";

type Provider = z.infer<typeof ProvidersSchema>[number];

type Props = {
  providers: Provider[];
  onCopyUrl?: (id: string) => void;
  onOpen?: (id: string) => void;
};

export const ProvidersGrid: FC<Props> = ({ providers, onCopyUrl, onOpen }) => {
  const valid = ProvidersSchema.safeParse(providers);
  const list = valid.success ? valid.data : [];

  return (
    <section
      aria-label="AI providers"
      data-testid="providers-grid"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {list.length === 0 && (
        <p className="text-sm text-gray-500" role="status" aria-live="polite">
          No providers available.
        </p>
      )}
      {list.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          onCopyUrl={onCopyUrl}
          onOpen={onOpen}
        />
      ))}
    </section>
  );
};

export default ProvidersGrid;
