import '@/styles/globals.css';

export const metadata = {
  title: 'Admin · Promagen',
  description: 'Internal control panel for Promagen data sources.'
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-gradient-to-b from-[#0b1220] to-[#111827] text-white">
        <header className="sticky top-0 border-b border-white/10 bg-black/20 px-6 py-3 text-sm font-semibold">
          Promagen Admin
        </header>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </body>
    </html>
  );
}
