'use client';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <main style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Image Model Providers</h1>
      <div
        style={{
          border: '1px solid #fecaca',
          background: '#fef2f2',
          color: '#7f1d1d',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <strong>Failed to load providers.</strong>
        <div style={{ marginTop: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>{error.message}</div>
      </div>
    </main>
  );
}


