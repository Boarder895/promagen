'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000';

export default function Page() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.2);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMsg[]>([
    { role: 'system', content: 'You are a helpful assistant.' },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // fetch model list on load
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/ai/openai/models`);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.models) && j.models.length) {
          setModels(j.models);
          if (!j.models.includes(model)) setModel(j.models[0]);
        } else {
          // keep default if listing fails; not fatal
          setModels([model]);
        }
      } catch {
        setModels([model]);
      }
    })();
  }, []); // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' });
  }, [history, busy]);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setError(null);

    const nextHistory = [...history, { role: 'user', content: input.trim() } as ChatMsg];
    setHistory(nextHistory);
    setInput('');

    try {
      const r = await fetch(`${API_BASE}/api/ai/openai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature,
          messages: nextHistory,
        }),
      });

      const j = await r.json();
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error ?? 'Request failed');
      }

      const assistant: ChatMsg = { role: 'assistant', content: j.text ?? '' };
      setHistory((h) => [...h, assistant]);
    } catch (e: any) {
      setError(e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    setHistory([{ role: 'system', content: 'You are a helpful assistant.' }]);
    setError(null);
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Promagen · OpenAI Proxy Test</h1>
      <p className="text-sm opacity-80">Backend: {API_BASE}</p>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Model</span>
          <select
            className="rounded border px-2 py-1"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm">Temperature: {temperature.toFixed(2)}</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            onClick={resetChat}
            className="rounded border px-3 py-2 hover:bg-gray-50"
            disabled={busy}
          >
            Reset
          </button>
          <a
            href={`${API_BASE}/api/health`}
            target="_blank"
            className="rounded border px-3 py-2 hover:bg-gray-50"
          >
            Health
          </a>
        </div>
      </section>

      <section
        ref={scrollRef}
        className="mt-4 h-[50vh] w-full overflow-auto rounded border p-3"
      >
        {history.map((m, i) => (
          <div key={i} className="mb-3">
            <div className="text-xs font-mono opacity-60">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {busy && <div className="text-sm opacity-70">Thinking…</div>}
      </section>

      {error && (
        <div className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-3 flex gap-2">
        <textarea
          className="min-h-[90px] flex-1 resize-y rounded border p-2"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') send();
          }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          className="h-[90px] min-w-[110px] self-end rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
      </section>

      <footer className="mt-6 text-xs opacity-60">
        Tip: Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send.
      </footer>
    </main>
  );
}
