'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message || 'Unknown error';
  const digest = error?.digest;

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Something went sideways.
        </h1>

        <p style={{ color: '#666', marginBottom: 16 }}>
          {message} {digest ? `(digest: ${digest})` : ''}
        </p>

        <p style={{ color: '#666', marginBottom: 24 }}>
          This might clear if you refresh the page. If it keeps happening, you can mention the
          message above when you contact support.
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'centre',
            gap: 8,
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.6)',
            padding: '6px 14px',
            background: 'white',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
