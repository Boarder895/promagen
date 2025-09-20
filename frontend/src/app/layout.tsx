// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import Providers from './providers'   // <— moved from src/pages/providers.tsx

export const metadata: Metadata = {
  title: 'Promagen',
  description: 'Admin & provider dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
