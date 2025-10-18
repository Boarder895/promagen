import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import StockRibbon from "@/components/StockRibbon";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Promagen",
  description: "AI image platforms with live global exchanges ribbon"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        {/* Persistent ribbon at the top (desktop/tablet) */}
        <div className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur">
          <div className="mx-auto max-w-[1600px] px-6 py-2 flex items-center justify-between">
            <StockRibbon />
            <ThemeToggle />
          </div>
        </div>

        {/* Page content */}
        <main className="mx-auto max-w-[1600px] px-6 py-10">{children}</main>
      </body>
    </html>
  );
}





