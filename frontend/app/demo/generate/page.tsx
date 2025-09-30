"use client";

import React, { useEffect, useState } from "react";
import { getProviders, type Provider } from "@/lib/providers";

export default function GeneratePage() {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    getProviders()
      .then((list) => setProviders([...list])) // spread = mutable copy
      .catch(() => setProviders([]));
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Generate</h1>
      <ul className="list-disc pl-5">
        {providers.map((p) => (
          <li key={p.id} className="mb-1">
            {p.name} {p.hasApi ? "(API)" : "(UI)"}
          </li>
        ))}
      </ul>
    </main>
  );
}

