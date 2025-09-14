import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promagen — Leaderboard",
  description: "Live leaderboard of AI image providers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Promagen Leaderboard</h1>
            <div className="text-sm text-gray-500">Alpha demo</div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
