import { getMeta } from '@/lib/api';

export default async function StatusPage() {
  // getMeta requires a key
  const meta = getMeta('status');

  return (
    <div className="max-w-xl px-6 space-y-3">
      <h1 className="text-xl font-semibold">Status</h1>
      <p className="opacity-70">{meta.title}</p>
      <ul className="list-disc pl-6">
        <li>Frontend: OK</li>
        <li>API: OK</li>
        <li>DB: OK</li>
      </ul>
    </div>
  );
}




