'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">500 — Something went wrong</h1>
      <p className="opacity-70">{error?.message ?? 'Unknown error'}</p>
      <button className="rounded-md border px-4 py-2" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
