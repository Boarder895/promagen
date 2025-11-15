import React, { useEffect, useState } from "react";

type Provider =
  | "artistly"
  | "openai"
  | "stability"
  | "leonardo"
  | "ideogram"
  | "fotor"
  | "nightcafe";

const PROVIDERS: Provider[] = [
  "artistly",
  "openai",
  "stability",
  "leonardo",
  "ideogram",
  "fotor",
  "nightcafe",
];

const API_BASE =
  process.env.NEXT_PUBLIC_PROMAGEN_API_BASE ?? "http://localhost:4000";

const apiUrl = (path: string) => `${API_BASE}${path}`;

type ProvidersResponse = {
  providers?: Provider[];
};

type TestResult = {
  provider: Provider;
  ok: boolean;
  body: string;
};

export default function ApiKeysPanel(): JSX.Element {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);

  const [formProvider, setFormProvider] = useState<Provider>("artistly");
  const [apiKey, setApiKey] = useState("");

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [rotateFor, setRotateFor] = useState<Provider | null>(null);
  const [rotateKey, setRotateKey] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Provider | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/keys/providers"), {
        cache: "no-store",
      });
      const data = (await res.json()) as ProvidersResponse;
      setProviders(data.providers ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load providers.",
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save(): Promise<void> {
    if (!apiKey.trim()) {
      setStatus("Enter an API key first.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setError(null);
    setTestResult(null);
    setPendingDelete(null);
    setRotateFor(null);

    try {
      await fetch(apiUrl("/api/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formProvider,
          apiKey: apiKey.trim(),
        }),
      });

      setApiKey("");
      setStatus(`Key saved for ${formProvider}.`);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save API key.",
      );
    } finally {
      setLoading(false);
    }
  }

  function startRotate(provider: Provider): void {
    setRotateFor(provider);
    setRotateKey("");
    setStatus(null);
    setError(null);
    setTestResult(null);
    setPendingDelete(null);
  }

  async function submitRotate(): Promise<void> {
    if (!rotateFor) {
      return;
    }
    if (!rotateKey.trim()) {
      setStatus("Enter a new API key first.");
      return;
    }

    setLoading(true);
    setStatus(null);
    setError(null);
    setTestResult(null);
    setPendingDelete(null);

    try {
      await fetch(apiUrl(`/api/keys/${rotateFor}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: rotateKey.trim() }),
      });

      setStatus(`Key updated for ${rotateFor}.`);
      setRotateFor(null);
      setRotateKey("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to rotate API key.",
      );
    } finally {
      setLoading(false);
    }
  }

  function cancelRotate(): void {
    setRotateFor(null);
    setRotateKey("");
  }

  async function remove(provider: Provider): Promise<void> {
    if (pendingDelete !== provider) {
      setPendingDelete(provider);
      setStatus(`Press delete again to remove the key for ${provider}.`);
      setError(null);
      setTestResult(null);
      return;
    }

    setLoading(true);
    setStatus(null);
    setError(null);
    setTestResult(null);

    try {
      await fetch(apiUrl(`/api/keys/${provider}`), { method: "DELETE" });
      setStatus(`Key removed for ${provider}.`);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete API key.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function testDecrypt(provider: Provider): Promise<void> {
    setLoading(true);
    setStatus(null);
    setError(null);
    setTestResult(null);
    setPendingDelete(null);

    try {
      const res = await fetch(apiUrl(`/api/providers/${provider}/test`), {
        method: "POST",
      });
      const json = await res.json();
      const body = JSON.stringify(json, null, 2);

      setTestResult({
        provider,
        ok: res.ok,
        body,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to run test.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="api-keys-heading"
      className="mx-auto my-8 max-w-2xl px-4 font-sans text-sm text-zinc-100"
      data-testid="api-keys-panel"
    >
      <header className="space-y-1">
        <h1
          id="api-keys-heading"
          className="text-lg font-semibold text-zinc-50"
        >
          API keys
        </h1>
        <p className="text-xs text-zinc-400">
          Store encrypted API keys for your favourite providers. This screen is
          only visible to you.
        </p>
      </header>

      {status && (
        <p
          className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
          role="status"
          aria-live="polite"
          data-testid="api-keys-status"
        >
          {status}
        </p>
      )}

      {error && (
        <p
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
          data-testid="api-keys-error"
        >
          {error}
        </p>
      )}

      <section
        aria-label="Add or replace a key"
        className="mt-6 mb-6 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"
        data-testid="api-keys-form"
      >
        <h2 className="mb-3 text-sm font-medium text-zinc-50">
          Add or replace a key
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col text-xs text-zinc-200 sm:w-40">
            <span>Provider</span>
            <select
              value={formProvider}
              onChange={(event) =>
                setFormProvider(event.target.value as Provider)
              }
              disabled={loading}
              className="mt-1 h-9 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            >
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col text-xs text-zinc-200">
            <span>API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              disabled={loading}
              className="mt-1 h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 font-mono text-xs text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
            />
          </label>

          <button
            type="button"
            onClick={() => void save()}
            disabled={loading}
            data-testid="api-keys-save"
            className="mt-2 inline-flex items-center justify-center rounded-full border border-emerald-700 bg-emerald-600 px-4 py-2 text-xs font-medium text-emerald-50 shadow-sm transition hover:bg-emerald-500 disabled:cursor-default disabled:border-emerald-900/60 disabled:bg-emerald-900/70 sm:mt-0"
          >
            {loading ? "Working…" : "Save"}
          </button>
        </div>
      </section>

      <section
        aria-label="Stored API keys"
        className="mt-4"
        data-testid="api-keys-stored"
      >
        <h2 className="mb-2 text-sm font-medium text-zinc-50">Stored keys</h2>

        {providers.length === 0 ? (
          <p className="text-xs text-zinc-400">
            No keys have been saved yet.
          </p>
        ) : (
          <ul
            className="divide-y divide-zinc-800 border-t border-zinc-800 text-sm"
            data-testid="api-keys-list"
          >
            {providers.map((provider) => (
              <li
                key={provider}
                className="flex flex-col gap-2 py-2"
                data-testid={`api-keys-item-${provider}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {provider}
                    </div>
                    <div className="text-xs text-emerald-500">Key stored</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startRotate(provider)}
                      disabled={loading}
                      data-testid={`api-keys-rotate-${provider}`}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60"
                    >
                      Rotate
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(provider)}
                      disabled={loading}
                      data-testid={`api-keys-delete-${provider}`}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        pendingDelete === provider
                          ? "border-red-500 bg-red-900 text-red-50"
                          : "border-red-700/70 bg-red-950/60 text-red-100 hover:bg-red-900"
                      } disabled:cursor-default disabled:opacity-60`}
                    >
                      {pendingDelete === provider ? "Confirm delete" : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void testDecrypt(provider)}
                      disabled={loading}
                      data-testid={`api-keys-test-${provider}`}
                      className="rounded-md border border-sky-700/70 bg-sky-950/60 px-2 py-1 text-xs text-sky-100 hover:bg-sky-900 disabled:cursor-default disabled:opacity-60"
                    >
                      Test
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rotateFor && (
        <section
          aria-label="Rotate API key"
          className="mt-6 rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-100"
          data-testid="api-keys-rotate-form"
        >
          <div className="mb-2 font-medium">
            Rotate key for <span className="font-semibold">{rotateFor}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-[11px] text-zinc-300">New API key</span>
              <input
                type="password"
                value={rotateKey}
                onChange={(event) => setRotateKey(event.target.value)}
                autoComplete="off"
                disabled={loading}
                className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 font-mono text-[11px] text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/70"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => void submitRotate()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full border border-emerald-700 bg-emerald-600 px-3 py-1 text-[11px] font-medium text-emerald-50 hover:bg-emerald-500 disabled:cursor-default disabled:border-emerald-900/60 disabled:bg-emerald-900/70"
              >
                Save new key
              </button>
              <button
                type="button"
                onClick={cancelRotate}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-[11px] text-zinc-100 hover:bg-zinc-800 disabled:cursor-default disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {testResult && (
        <section
          aria-label="Last test result"
          className="mt-6 rounded-md border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-100"
          data-testid="api-keys-test-result"
        >
          <div className="mb-2 font-medium">
            Test for {testResult.provider}:{" "}
            {testResult.ok ? "succeeded" : "failed"}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono">
            {testResult.body}
          </pre>
        </section>
      )}
    </section>
  );
}
