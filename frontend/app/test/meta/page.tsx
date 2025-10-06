import { getMeta } from '@/lib/api';

export default async function MetaTestPage() {
  const meta = getMeta('test/meta'); // ðŸ”§ pass a key
  const pretty = JSON.stringify(meta, null, 2);

  return (
    <div className="max-w-xl px-6 space-y-3">
      <h1 className="text-xl font-semibold">Meta Test</h1>
      <pre className="rounded bg-neutral-950/5 p-4 text-sm">{pretty}</pre>
    </div>
  );
}



