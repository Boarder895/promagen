"use client";

import React from "react";
import type { Exchange } from "./exchange-card";
import ExchangeCard from "./exchange-card";

type Props = {
  title: string;
  items: Exchange[];
  side: "east" | "west";
};

export default function ExchangeColumn({ title, items, side }: Props): JSX.Element {
  return (
    <section
      role="complementary"
      aria-label={`${title} exchanges`}
      className={side === "east" ? "space-y-3" : "space-y-3"}
      data-testid={`column-${side}`}
    >
      <h2 className="sr-only">{title}</h2>
      <ul role="list" className="space-y-2">
        {items.map((x) => (
          <li key={x.id} role="listitem" aria-label={`${x.name} exchange`}>
            <article className="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
              <ExchangeCard exchange={x} />
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
