'use client';

type Provider = { id: string; name: string };

const providers: Provider[] = [
  // add real providers later
];

export function ProviderGrid() {
  if (!providers.length) return <p className="text-sm opacity-70">No providers yet.</p>;

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

export default ProviderGrid;





