export default function Page() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "— not set —";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: 24,
      }}
    >
      {/* Floating theme icon (homepage only). Choice persists site-wide */}
      <ThemeFab />

      <header style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 36 }}>Promagen</h1>
        <p style={{ marginTop: 8, color: "var(--muted)" }}>
          Frontend is live on Vercel.
        </p>
      </header>

      <section
        style={{
          padding: 16,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--card-bg)",
        }}
      >
        <strong>API base:</strong> {apiBase}
      </section>

      <footer style={{ marginTop: 24, color: "var(--muted)" }}>
        <span>Private preview — not indexed.</span>
      </footer>
    </main>
  );
}

/** Inline floating Light/Dark/System icon
 * - Cycles: Light → Dark → System
 * - Saves to localStorage('theme')
 * - Works with the early script in layout.tsx (no flicker, site-wide)
 */
function ThemeFab() {
  // Keep state minimal; read/write storage directly
  const cycle = () => {
    try {
      const KEY = "theme";
      const opts = ["light", "dark", "system"] as const;
      const stored = localStorage.getItem(KEY);
      const curr = opts.includes(stored as any) ? (stored as typeof opts[number]) : "system";
      const next = opts[(opts.indexOf(curr) + 1) % opts.length];

      localStorage.setItem(KEY, next);

      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const dark = next === "dark" || (next === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", !!dark);
    } catch {}
  };

  const label =
    typeof window === "undefined"
      ? "Theme"
      : (localStorage.getItem("theme") as "light" | "dark" | "system" | null) ?? "system";

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${(label ?? "system").replace(/^./, (c) => c.toUpperCase())} (click to change)`}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9999,
        width: 44,
        height: 44,
        borderRadius: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "color-mix(in oklab, var(--bg), #ffffff 12%)",
        border: "1px solid var(--border)",
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
        cursor: "pointer",
      }}
    >
      <ThemeIcon />
    </button>
  );
}

function ThemeIcon() {
  // Simple "system" half icon; colour inherits var(--fg)
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="currentColor"
      style={{ color: "var(--fg)" }}
    >
      {/* This shape is read fine for all three modes; users learn the cycle by clicking */}
      <path d="M12 2v20a10 10 0 000-20zM4 12a8 8 0 008 8V4a8 8 0 00-8 8z" />
    </svg>
  );
}
