"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Props = { label?: string };

export const RunAcrossProvidersButton = ({ label = "Run across providers" }: Props) => {
  const router = useRouter();

  const handleClick = useCallback(() => {
    // Typed-routes friendly: literal pathname + optional query marker
    router.push("/run-across-providers?" as Route);
  }, [router]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold shadow hover:shadow-md active:translate-y-px transition
                 bg-black text-white dark:bg-white dark:text-black"
      aria-label={label}
    >
      {label}
    </button>
  );
};









