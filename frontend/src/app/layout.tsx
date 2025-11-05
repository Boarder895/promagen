// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import TopNav from "@/components/nav/top-nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Promagen",
  description: "Live markets + AI image platforms, side by side.",
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-neutral-950">
      <body className={`${inter.className} min-h-screen text-neutral-100 antialiased`}>
        <TopNav />
        {children}
      </body>
    </html>
  );
}















