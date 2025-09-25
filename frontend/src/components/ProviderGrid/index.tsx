// src/components/ProviderGrid/index.tsx
import React from "react";
import PROVIDERS, { type Provider } from "@/lib/providers";
import { fetchProviders } from "@/lib/api";

export const revalidate = 60;

type Kind = "all" | "api" | "manual";

/** Accepts either `kind` or legacy `filter` prop. */
export default async function ProviderGrid(props: { kind?: Kind; filter?: Kind; prompt?: unknown }) {
  const kind: Kind = props.kind ?? props.filter ?? "all";

  let list: Provider[] = [];
  try {
    list = await fetchProviders();
  } catch {
    // ignore network errors and fall back
  }
  if (!list?.length) list = PROVIDERS;

  const items =
    kind === "api" ? list.filter((p) => !!p.api)
    : kind === "manual" ? list.filter((p) => !p.api)
    : list;

  return (
    <div className="grid grid-cols-12 gap-2">
      <div className="col-span-4 font-medium border-b pb-1">Name</div>
      <div className="col-span-3 font-medium border-b pb-1">ID</div>
      <div className="col-span-2 font-medium border-b pb-1">API</div>
      <div className="col-span-3 font-medium border-b pb-1">Affiliate</div>
      {items.map((p) => (
        <React.Fragment key={p.id}>
          <div className="col-span-4 py-2 border-b">{p.name}</div>
          <div className="col-span-3 py-2 border-b">{p.id}</div>
          <div className="col-span-2 py-2 border-b">{p.api ? "Yes" : "No"}</div>
          <div className="col-span-3 py-2 border-b">{p.affiliate ? "Yes" : "No"}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

