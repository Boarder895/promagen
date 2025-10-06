// FRONTEND · NEXT.JS APP ROUTER
// REPLACE FILE: app/docs/users-book/page.tsx
// Page files must default-export a React component (server component is fine)

import * as React from "react";

export const metadata = {
  title: "Users’ Book – Promagen",
  description: "Current user-facing status and links.",
};

// Keep it brutally simple first; we’ll re-attach fancy sections after it renders.
const UsersBookPage = () => {
  return (
    <main className="prose-doc mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold mb-2">Users’ Book</h1>
      <p className="text-sm opacity-70 mb-6">
        Last updated: <time>{new Date().toLocaleString()}</time>
      </p>

      <section className="rounded-2xl border p-5 mb-6 bg-white/60">
        <h2 className="text-xl font-semibold mb-3">Where we are today</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Docs live under <code>/app/docs/*</code> (App Router only).</li>
          <li>Providers list is locked (frontend is the source of truth until launch).</li>
          <li>API on Fly.io with <code>/health</code> at root, features under <code>/api/v1/*</code>.</li>
          <li>Ports: UI 3000, API 3001.</li>
        </ul>
      </section>

      <section className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold mb-3">Videos</h2>
        <p className="text-sm opacity-80">We’ll add your YouTube links once this page is stable.</p>
      </section>
    </main>
  );
};

export default UsersBookPage;

