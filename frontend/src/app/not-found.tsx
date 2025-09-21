// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h2 className="text-xl font-semibold mb-2">Not Found</h2>
      <p className="opacity-80 mb-4">Could not find the requested resource.</p>
      <Link href="/" className="underline">Return Home</Link>
    </main>
  );
}
