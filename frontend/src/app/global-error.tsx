'use client';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  return (
    <html>
      <body className="min-h-screen bg-red-50 text-red-900">
        <div className="mx-auto max-w-xl p-6">
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="mb-4">
            {error.message || 'Unexpected error'} {error.digest ? <span className="opacity-70">[ref: {error.digest}]</span> : null}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-white px-3 py-2 text-sm font-medium ring-1 ring-red-300 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
