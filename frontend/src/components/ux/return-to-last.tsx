import React, { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "last_provider";

export default function ReturnToLast(): JSX.Element | null {
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      setLast(v);
    } catch {
      setLast(null);
    }
  }, []);

  if (!last) return null;

  return (
    <div className="mt-3">
      <Link
        href={`/providers/${last}`}
        data-testid="return-to-last"
        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/15"
        aria-label={`Return to ${last}`}
      >
        ↩︎ Back to {last}
      </Link>
    </div>
  );
}
