"use client";

import Link from "next/link";
import { Routes } from "@/lib/routes";

type Props = { providerId: string; currentId?: string };

export default function ReturnToLastPlatform({ providerId, currentId }: Props) {
  const href = Routes.provider(providerId);
  const isCurrent = currentId && currentId === providerId;

  return (
    <p className="text-xs text-white/60">
      Back to{" "}
      <Link
        className="underline hover:text-white/80"
        href={href}
        aria-label="Back to provider platform"
        aria-current={isCurrent ? "page" : undefined}
        data-testid="return-to-last-platform"
      >
        platform
      </Link>
      .
    </p>
  );
}
