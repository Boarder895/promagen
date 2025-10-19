import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import StockRibbon from "@/components/StockRibbon";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Promagen",
  description: "AI image platforms with live global exchanges ribbon",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* body picks up theme via Tailwind tokens */}
      <body className="min-h-screen bg-background text-foreground">
        {/* Sticky ribbon (desktop/tablet) */}
        <div className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-2">
            <StockRibbon />
            <ThemeToggle />
          </div>
        </div>

        <main className="mx-auto max-w-[1600px] px-6 py-10">{children}</main>
      </body>
    </html>
  );
}






