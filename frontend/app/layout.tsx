import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Promagen",
  description: "Promagen frontend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <Header />
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
