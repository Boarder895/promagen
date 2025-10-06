// @/components/DisclosureBanner.tsx
"use client";
import { BRANDS } from "@/lib/config";

export function DisclosureBanner() {
  return (
    <div className="w-full text-center text-xs md:text-sm py-2 px-3 bg-amber-50 border border-amber-200 rounded-xl">
      <span className="font-medium">Affiliate Notice: </span>
      <span>{BRANDS.affiliateDisclosureText}</span>
    </div>
  );
}

