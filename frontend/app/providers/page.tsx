import ProviderGrid from '@/components/ProviderGrid'

export default function ProvidersPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Providers</h1>
      <p style={{ color: 'var(--muted)' }}>
        Front-end truth from <code>src/lib/providers.ts</code>. Edit that file to update this list.
      </p>
      <ProviderGrid />
    </main>
  )
}
