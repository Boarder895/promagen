"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (dark) {document.documentElement.classList.add("dark");}
    else {document.documentElement.classList.remove("dark");}
  }, [dark]);

  return (
    <button
      className="rounded-full border border-white/15 px-3 py-1 text-sm hover:border-white/30"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
    >
      {dark ? "Night" : "Day"}
    </button>
  );
}







