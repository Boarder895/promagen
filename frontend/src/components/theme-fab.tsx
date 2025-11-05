"use client";

import { useEffect, useState } from "react";

export default function ThemeFab() {
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    // Persist simple theme preference in localStorage for Stage 1.
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        padding: "10px 12px",
        borderRadius: 999,
        boxShadow: "0 4px 12px rgba(0,0,0,.2)",
      }}
    >
      {dark ? "??" : "??"}
    </button>
  );
}











