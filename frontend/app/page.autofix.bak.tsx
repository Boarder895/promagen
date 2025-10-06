import { ProvidersBoard } from '@/components/ProvidersBoard';
import { ExchangeBoard } from '@/components/ExchangeBoard';

export const metadata = {
  title: 'Promagen Ãƒâ€šÃ‚Â· AI Image Providers & Global Markets',
  description: 'Live provider scores (7 criteria) and stock exchange deltas.',
};

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold">Promagen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live movement: 7-criteria scores and global exchange deltas.
          </p>
        </header>
      </div>
      <ProvidersBoard />
      <ExchangeBoard />
      <footer className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12 pt-6 text-xs text-muted-foreground">
        Some links above may be affiliate links (UK disclosure).
      </footer>
    </main>
  );
}
