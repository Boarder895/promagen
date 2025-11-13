import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promagen – Social preview",
  description:
    "AI creativity ⭐ market mood – calm, data-rich and beautifully simple.",
};

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

export default function OpenGraphPreviewPage() {
  const size = {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#020617", // near-black, calm
        color: "#f9fafb",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: size.width,
          height: size.height,
          borderRadius: 32,
          padding: 64,
          boxSizing: "border-box",
          background:
            "radial-gradient(circle at 0% 0%, #1f2937 0, #020617 45%, #000000 100%)",
          boxShadow:
            "0 40px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.12)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Top content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {/* Title */}
          <div style={{ fontSize: 44, fontWeight: 700 }}>Promagen</div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 20,
              opacity: 0.9,
              maxWidth: 900,
              lineHeight: 1.25,
            }}
          >
            AI creativity{" "}
            <span aria-hidden="true" style={{ marginLeft: 4, marginRight: 4 }}>
              ⭐
            </span>
            market mood – calm, data-rich and beautifully simple.
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 20,
            opacity: 0.8,
          }}
        >
          {/* Hostname */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "9999px",
                background:
                  "radial-gradient(circle at 30% 30%, #4ade80 0, #22c55e 40%, #15803d 100%)",
              }}
            />
            <span>promagen.ai</span>
          </div>
        </div>
      </div>
    </main>
  );
}
