// src/pages/providers.tsx
import ProviderGrid from '@/components/ProviderGrid';

export default function ProvidersPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ProviderGrid filter="all" />
    </main>
  );
}
