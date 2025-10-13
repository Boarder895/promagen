ï»¿export const metadata = { title: 'Promagen' };

import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <nav style={{ marginBottom: 16 }}>
          <Link href="/" style={{ marginRight: 12 }}>
            Home
          </Link>
          <Link href="/settings/keys">Settings â†’ Keys</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}

