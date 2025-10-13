// App Router page at /admin
// Note: Next.js requires a default export for page components (allowed exception in your ESLint overrides).

export const dynamic = 'force-static'; // optional, safe default for admin

export default function AdminPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <p className="opacity-70">Admin home is alive. Use the menu to run sync/ping etc.</p>
    </main>
  );
}




