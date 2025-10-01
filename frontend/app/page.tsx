// Server Component â€” safe to render on the server.
// Pass only serialisable props (no functions / event handlers).

import RunPanel from "@/components/RunPanel";

export default function Page() {
  return (
    <main className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Promagen</h1>
      <p className="opacity-70 max-w-[60ch]">
        Welcome to your Option A demo surface. The button below is rendered
        by a Client Component and owns its own event handlers, which keeps the
        server/client boundary happy.
      </p>

      {/* Only data, never functions */}
      <RunPanel initialLabel="Run" />
    </main>
  );
}


