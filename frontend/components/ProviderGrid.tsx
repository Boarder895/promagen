'use client';

type Provider = { id: string; name: string };

const providers: Provider[] = [
  // keep it empty or add names later; build just needs the file to exist
  // { id: 'openai', name: 'OpenAI' },
];

export default function ProviderGrid() {
  if (!providers.length) {
    return <p className="text-sm opacity-70">No providers yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <div key={p.id} className="rounded-lg border p-3">
          <div className="font-medium">{p.name}</div>
        </div>
      ))}
    </div>
  );
}
