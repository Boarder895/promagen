import { PROVIDERS } from '@/data/providers';

type PageProps = { params: { id: string } };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function ProviderDetailPage({ params }: PageProps) {
  const id = params.id;
  const found = (PROVIDERS as any[]).find(
    (p) => String(p.id) === id || slug(String(p.name ?? p.displayName ?? '')) === id
  );

  if (!found) {
    return (
      <main className="mx-auto max-w-screen-md px-6 py-10">
        <h1 className="text-2xl font-semibold">Provider not found</h1>
        <p className="text-sm text-neutral-500 mt-2">ID: {id}</p>
      </main>
    );
  }

  const name = String(found.name ?? found.displayName ?? 'Unknown');
  const url = String(found.url ?? found.website ?? '#');

  return (
    <main className="mx-auto max-w-screen-md px-6 py-10">
      <h1 className="text-2xl font-semibold mb-2">{name}</h1>
      <a className="text-indigo-400 hover:underline text-sm" href={url} target="_blank" rel="noreferrer">
        Visit {name}
      </a>
      {found.tagline ? <p className="mt-3 text-sm text-neutral-400">{String(found.tagline)}</p> : null}
    </main>
  );
}
