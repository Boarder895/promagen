import React, { useEffect, useState } from "react";

type Provider =
  | "artistly" | "openai" | "stability" | "leonardo" | "ideogram" | "fotor" | "nightcafe";

const PROVIDERS: Provider[] = ["artistly","openai","stability","leonardo","ideogram","fotor","nightcafe"];

const API = (path: string) => `http://localhost:4000${path}`;

export default function ApiKeysPanel() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [formProvider, setFormProvider] = useState<Provider>("artistly");
  const [apiKey, setApiKey] = useState("");

  async function refresh() {
    const res = await fetch(API("/api/keys/providers"));
    const data = await res.json();
    setProviders(data.providers ?? []);
  }

  useEffect(() => { refresh(); }, []);

  async function save() {
    setLoading(true);
    try {
      await fetch(API("/api/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: formProvider, apiKey })
      });
      setApiKey("");
      await refresh();
    } finally { setLoading(false); }
  }

  async function rotate(p: Provider) {
    const newKey = prompt(`New API key for ${p}?`);
    if (!newKey) return;
    await fetch(API(`/api/keys/${p}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: newKey })
    });
    await refresh();
  }

  async function remove(p: Provider) {
    if (!confirm(`Delete key for ${p}?`)) return;
    await fetch(API(`/api/keys/${p}`), { method: "DELETE" });
    await refresh();
  }

  async function testDecrypt(p: Provider) {
    const res = await fetch(API(`/api/providers/${p}/test`), { method: "POST" });
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h1>API Keys</h1>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <select value={formProvider} onChange={e => setFormProvider(e.target.value as Provider)}>
          {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input
          placeholder="paste API key…"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          style={{ flex: 1 }}
        />
        <button disabled={loading || !apiKey} onClick={save}>Save</button>
      </div>

      <h3>Stored</h3>
      {providers.length === 0 ? <p>No providers saved yet.</p> : (
        <ul>
          {providers.map(p => (
            <li key={p} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ minWidth: 120 }}>{p}</code>
              <button onClick={() => testDecrypt(p)}>Test</button>
              <button onClick={() => rotate(p)}>Rotate</button>
              <button onClick={() => remove(p)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
