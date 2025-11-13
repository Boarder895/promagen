/**
 * 404 page — SSR-safe, neutral copy, keyboard-friendly.
 */
export const metadata = {
  title: 'Not found · Promagen',
  description: 'The page you’re after does not exist.',
};

export default function NotFound() {
  return (
    <main role="main" className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-sm text-white/75">
        The page you requested doesn’t exist or may have moved.
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
