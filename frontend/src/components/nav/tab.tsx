"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackTabClicked } from "@/lib/analytics";
import Icon from "@/components/ui/icon";

type Props = {
  label: string;
  href: string;
  isActive: boolean;
  icon?: string; // emoji id from your bank
  disabled?: boolean;
  badge?: string | number | null;
  onClick?: (id: string) => void;
  id?: string; // analytics id (defaults to kebab-case label)
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function NavTab({
  label,
  href,
  isActive,
  icon,
  disabled,
  badge,
  onClick,
  id,
}: Props) {
  const router = useRouter();
  const tabId = id || label.toLowerCase().replace(/\s+/g, "-");

  const base =
    "relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors";
  const active =
    "bg-neutral-900 text-white dark:bg-white dark:text-black";
  const inactive =
    "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800";
  const disabledCls = "opacity-50 pointer-events-none";

  const className = cx(
    base,
    isActive ? active : inactive,
    disabled ? disabledCls : undefined,
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600"
  );

  const content = (
    <>
      {icon ? <Icon name={icon as any} className="text-base" /> : null}
      <span className="truncate max-w-[12ch]" title={label}>
        {label}
      </span>
      {badge !== null && badge !== undefined ? (
        <span className="ml-1 rounded-md bg-neutral-200 px-1.5 py-0.5 text-xs leading-none text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
          {badge}
        </span>
      ) : null}

      {/* Underline indicator (within each tab, smooth but reduced-motion friendly) */}
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute inset-x-2 -bottom-[2px] h-[2px] rounded-full transition-[transform,opacity,width]",
          isActive
            ? "opacity-100 bg-current"
            : "opacity-0 bg-current",
          "motion-reduce:transition-none"
        )}
      />
    </>
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false} // manual, on hover
      aria-current={isActive ? "page" : undefined}
      className={className}
      onMouseEnter={() => {
        // Hover prefetch (bandwidth-friendly)
        try {
          router.prefetch?.(href);
        } catch {}
      }}
      onClick={() => {
        trackTabClicked({ feature: "providers", tabId, source: "route", path: href });
        onClick?.(tabId);
      }}
    >
      {content}
    </Link>
  );
}

