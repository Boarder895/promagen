<<<<<<< HEAD
﻿export const metadata = { title: 'Promagen' };

import Link from 'next/link';
=======
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Promagen" };
>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
<<<<<<< HEAD
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <nav style={{ marginBottom: 16 }}>
          <Link href="/" style={{ marginRight: 12 }}>
            Home
          </Link>
          <Link href="/settings/keys">Settings → Keys</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
=======
      <body className="bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}


>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
