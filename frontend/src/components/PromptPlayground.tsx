'use client';

import React, { useEffect, useState } from 'react';
import { getProviders, type Provider } from '@/lib/providers';

export default function PromptPlayground() {
  const [providers, setProviders] = useState<Provider[]>([]);

  // Sync load: no promise, no .then()
  useEffect(() => {
    const list = getProviders();
    setProviders(list);
  }, []);

  return (
    <div className="p-4">
      <div className="text-sm">Providers: {providers.length}</div>
    </div>
  );
}




