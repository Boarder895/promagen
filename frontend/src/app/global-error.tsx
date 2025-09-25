// FRONTEND â€¢ NEXT.JS
// File: frontend/app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-red-50 text-red-900">
        <div className="mx-auto max-w-lg p-6">
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm mb-4">
            {error.message || "Unexpected error"} {error?.digest ? `(ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={() => reset()}
            className="rounded-md bg-red-600 text-white px-3 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
