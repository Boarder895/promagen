/**
 * Fallback bridge page – minimal and safe.
 * Renders when an internal bridge target isn’t available.
 */
export const metadata = {
  title: 'Bridge Fallback · Promagen',
  description: 'A safe landing page when a bridge route is unavailable.',
};

export default function BridgeFallbackPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">We can’t reach that bridge</h1>
      <p className="mt-3 text-sm text-white/75">
        The destination you attempted to open isn’t available right now. Try again shortly, or return to the homepage.
      </p>
      <div className="mt-6">
        <a
          href="/"
          className="inline-flex items-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          Go to homepage
        </a>
      </div>
    </main>
  );
}
