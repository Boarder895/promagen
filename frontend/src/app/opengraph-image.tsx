// frontend/src/app/opengraph-image.tsx

import { ImageResponse } from "next/og";

// Run this only on the edge runtime (what @vercel/og expects)
export const runtime = "edge";

// Tell Next this route is fully dynamic – do NOT prerender at build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// OG metadata
export const alt = "Promagen preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 48,
          background:
            "linear-gradient(188deg, #0b1220 0%, #111827 100%)",
          color: "white",
          boxSizing: "border-box",
        }}
      >
        {/* Title */}
        <div style={{ fontSize: 44, fontWeight: 700 }}>Promagen</div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            opacity: 0.9,
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          AI creativity ✨ market mood — calm, data-rich and beautifully
          simple.
        </div>

        {/* Hostname */}
        <div
          style={{
            display: "flex",
            fontSize: 20,
            opacity: 0.7,
          }}
        >
          promagen.ai
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
    }
  );
}
