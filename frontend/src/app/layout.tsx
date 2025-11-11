import type { Metadata } from "next";
import "./globals.css";
// Keep your PauseProvider + ProvenanceFooter, and add an ErrorBoundary wrapper.
import { PauseProvider } from "@/state/pause";
import ProvenanceFooter from "@/components/core/provenance-footer";
import ErrorBoundary from "@/components/error-boundary";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Promagen",
  description: "Calm, precise, and fast.",
  metadataBase: new URL(SITE),
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Promagen",
    description: "Calm, precise, and fast.",
    type: "website",
    url: SITE,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Promagen" }],
    siteName: "Promagen",
  },
  twitter: {
    card: "summary_large_image",
    title: "Promagen",
    description: "Calm, precise, and fast.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-dvh bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white antialiased">
        <PauseProvider>
          <ErrorBoundary>
            {children}
            <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
              <ProvenanceFooter />
            </div>
          </ErrorBoundary>
        </PauseProvider>
      </body>
    </html>
  );
}
