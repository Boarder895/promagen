"use client";

import React, { useEffect, useState } from "react";
import { getProviders, type Provider } from "@/lib/providers";

export default function PromptPlayground() {
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    getProviders().then((list) => setProviders(list ?? [])).catch(() => setProviders([]));
  }, []);
  return <div className="text-sm opacity-80">Providers: {providers.length}</div>;
}
