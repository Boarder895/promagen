// src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import Providers from './_providers'   // <â€” moved from src/page./_providers.tsx

export const metadata: Metadata = {
  title: 'Promagen',
  description: 'Admin & provider dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}./_providers>
      </body>
    </html>
  )
}
