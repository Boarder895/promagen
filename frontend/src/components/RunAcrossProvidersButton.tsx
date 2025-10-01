"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

export type Prompt = {
  id: string;
  text: string;
};

// Accept either the old shape { prompt: Prompt } or the new shape { promptId: string }
type Props =
  | { prompt: Prompt; label?: string; hrefBase?: string }
  | { promptId: string; label?: string; hrefBase?: string };

/**
 * RunAcrossProvidersButton
 * Named export only (no default), per repo convention.
 * Navigates to `hrefBase?promptId=<id>` (default: /run-across-providers).
 */
export const RunAcrossProvidersButton = (props: Props) => {
  const router = useRouter();

  const promptId =
    "promptId" in props ? props.promptId : props.prompt.id;

  const label = "label" in props && props.label ? props.label : "Run across providers";
  const hrefBase = "hrefBase" in props && props.hrefBase ? props.hrefBase : "/run-across-providers";

  const targetHref = useMemo(() => {
    const u = new URL(hrefBase, "http://localhost"); // base only to build search params
    u.searchParams.set("promptId", promptId);
    return `${u.pathname}${u.search}`;
  }, [hrefBase, promptId]);

  const handleClick = useCallback(() => {
    router.push(targetHref);
  }, [router, targetHref]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center rounded-2xl px-4 py-2 text-sm font-semibold shadow hover:shadow-md active:translate-y-px transition
                 bg-black text-white dark:bg-white dark:text-black"
      aria-label={label}
      data-prompt-id={promptId}
    >
      {label}
    </button>
  );
};
