"use client";
import * as React from "react";

export default function ExchangeBadge({ name }: { name: string }) {
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs">{name}</span>;
}



