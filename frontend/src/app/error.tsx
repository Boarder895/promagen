'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui', padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went sideways.</h1>
        <p style={{ color: '#666', marginBottom: 16 }}>
          {error.message || 'Unknown error'} {error?.digest ? `(digest: ${error.digest})` : ''}
        </p>
        <button
          onClick={() => reset()}
          style={{ border: '1px solid #ccc', padding: '6px 10px', borderRadius: 6 }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}







