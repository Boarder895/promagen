'use client';

import { useState } from 'react';

export default function EchoPage() {
  const [msg, setMsg] = useState<string>('—');

  async function run() {
    const res = await fetch('/api/echo-proxy', { method: 'POST' });
    const json = await res.json();
    setMsg(JSON.stringify(json));
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Echo Test</h1>
      <button onClick={run} className="rounded-xl px-4 py-2 border">Run echo</button>
      <pre className="p-3 border rounded-xl overflow-auto">{msg}</pre>
    </main>
  );
}
