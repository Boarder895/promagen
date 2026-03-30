// frontend/src/app/opengraph-image.tsx
//
// Dynamic Open Graph image generated at request time via @vercel/og.
// Shows in social shares (Twitter/X, LinkedIn, Slack, Discord, iMessage, etc.)
//
// Design: two-column layout — headline + chips left, prompt panel right.
// Matches the Promagen brand: dark navy, purple/pink accent, per-platform colours.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const alt = "Promagen — AI prompt builder for 40 image generators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Shared token values (no CSS variables in @vercel/og) ──────────────────────
const BG = "#090b14";
const PURPLE = "#c084fc";
const PURPLE_D = "#7c3aed";
const VIOLET = "#a78bfa";
const INDIGO = "#818cf8";
const TEAL = "#34d399";
const AMBER = "#fb923c";
const GOLD = "#facc15";
const PINK = "#f472b6";
const WHITE = "#ffffff";

// Platform row accent colours
const ROW = [
  {
    border: INDIGO,
    bg: "rgba(129,140,248,0.07)",
    name: INDIGO,
    label: "Midjourney",
    tier: "TIER 2",
  },
  {
    border: TEAL,
    bg: "rgba(52,211,153,0.07)",
    name: TEAL,
    label: "DALL·E 3",
    tier: "TIER 3",
  },
  {
    border: AMBER,
    bg: "rgba(251,146,60,0.07)",
    name: AMBER,
    label: "Flux",
    tier: "TIER 1",
  },
  {
    border: GOLD,
    bg: "rgba(250,204,21,0.07)",
    name: GOLD,
    label: "Leonardo",
    tier: "TIER 1",
  },
];

const PROMPTS = [
  "young woman kneeling, weathered fox shrine, deep cedar forest, moonlight, paper lanterns, --ar 16:9 --style raw --v 6.1",
  "A young woman kneels before a weathered fox shrine in a cedar forest under moonlight, paper lanterns casting soft amber glow, cinematic",
  "woman, kneeling, fox shrine, cedar forest, moonlight, paper lanterns, amber glow, moss, stone, cinematic lighting, atmospheric",
  "woman kneeling::2 fox shrine::1.8 cedar forest, moonlight::1.5 paper lanterns, amber, stone path, cinematic, night",
];

const CHIPS = [
  {
    label: "Midjourney",
    color: INDIGO,
    bg: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.35)",
  },
  {
    label: "DALL·E 3",
    color: TEAL,
    bg: "rgba(52,211,153,0.08)",
    border: "rgba(52,211,153,0.35)",
  },
  {
    label: "Flux",
    color: AMBER,
    bg: "rgba(251,146,60,0.08)",
    border: "rgba(251,146,60,0.35)",
  },
  {
    label: "Leonardo",
    color: GOLD,
    bg: "rgba(250,204,21,0.08)",
    border: "rgba(250,204,21,0.35)",
  },
  {
    label: "Adobe Firefly",
    color: PINK,
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.35)",
  },
  {
    label: "+ 35 more",
    color: "rgba(255,255,255,0.38)",
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
  },
];

export default function OpengraphImage() {
  return new ImageResponse(
    // ── Root ──────────────────────────────────────────────────────────────
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        background: BG,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Rainbow top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background:
            "linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#f97316,#eab308,#22c55e,#06b6d4,#6366f1)",
          display: "flex",
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
          display: "flex",
        }}
      />

      {/* Left glow */}
      <div
        style={{
          position: "absolute",
          left: -80,
          top: 115,
          width: 500,
          height: 500,
          background:
            "radial-gradient(ellipse at center,rgba(139,92,246,0.10) 0%,transparent 70%)",
          display: "flex",
          borderRadius: 9999,
        }}
      />

      {/* Right glow */}
      <div
        style={{
          position: "absolute",
          right: -60,
          top: 175,
          width: 380,
          height: 380,
          background:
            "radial-gradient(ellipse at center,rgba(236,72,153,0.07) 0%,transparent 70%)",
          display: "flex",
          borderRadius: 9999,
        }}
      />

      {/* ── Inner layout ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: 1200,
          height: 630,
          padding: "0 68px",
          gap: 52,
          position: "relative",
        }}
      >
        {/* ── LEFT COLUMN ─────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 456,
            gap: 14,
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {/* Icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 42,
                height: 42,
                flexShrink: 0,
                background: "linear-gradient(135deg,#1a1040,#2d1b6b)",
                borderRadius: 10,
                border: "1px solid rgba(139,92,246,0.4)",
              }}
            >
              {/* Bar chart bars */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 2.5,
                  height: 20,
                }}
              >
                {[
                  { h: 10, c: PURPLE },
                  { h: 14, c: VIOLET },
                  { h: 20, c: INDIGO },
                  { h: 14, c: PURPLE },
                  { h: 10, c: PINK },
                ].map((b, i) => (
                  <div
                    key={i}
                    style={{
                      width: 3.5,
                      height: b.h,
                      background: b.c,
                      borderRadius: 2,
                      display: "flex",
                    }}
                  />
                ))}
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.40)",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Promagen
            </span>
          </div>

          {/* Eyebrow */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.22em",
              color: VIOLET,
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Intelligent Prompt Builder
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1.08,
              gap: 0,
            }}
          >
            <span
              style={{
                fontSize: 57,
                fontWeight: 800,
                color: WHITE,
                letterSpacing: -1.4,
                display: "flex",
              }}
            >
              One Idea.
            </span>
            <span
              style={{
                fontSize: 57,
                fontWeight: 800,
                color: PURPLE,
                letterSpacing: -1.4,
                display: "flex",
              }}
            >
              40 Platforms.
            </span>
            <span
              style={{
                fontSize: 57,
                fontWeight: 800,
                color: WHITE,
                letterSpacing: -1.4,
                display: "flex",
              }}
            >
              Perfect Prompts.
            </span>
          </div>

          {/* Subtext */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 14,
              color: "rgba(255,255,255,0.58)",
              lineHeight: 1.55,
              maxWidth: 400,
            }}
          >
            {"Describe your scene once — Promagen translates it into "}
            <span
              style={{
                color: "rgba(255,255,255,0.88)",
                fontWeight: 600,
                marginLeft: 4,
              }}
            >
              platform-perfect prompts
            </span>
            {" for every major AI image generator."}
          </div>

          {/* Platform chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CHIPS.map((c, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "3.5px 11px",
                  borderRadius: 20,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: c.color,
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                }}
              >
                {c.label}
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 26,
              paddingTop: 13,
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {[
              { v: "40", l: "PLATFORMS" },
              { v: "10K+", l: "PHRASES" },
              { v: "4", l: "TIERS" },
              { v: "Live", l: "WORLD DATA" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: WHITE,
                    letterSpacing: -0.5,
                  }}
                >
                  {s.v}
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.30)",
                    marginTop: 2,
                  }}
                >
                  {s.l}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN — Prompt Panel ──────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            height: 488,
            position: "relative",
          }}
        >
          {/* Panel card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 13,
              overflow: "hidden",
            }}
          >
            {/* Panel header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "11px 17px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0,
              }}
            >
              {[0.18, 0.1, 0.06].map((a, i) => (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 9999,
                    background: `rgba(255,255,255,${a})`,
                    display: "flex",
                  }}
                />
              ))}
              <span
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginLeft: 4,
                  display: "flex",
                }}
              >
                Your Scene → Platform Prompts
              </span>
            </div>

            {/* Scene box */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                margin: "14px 17px 10px",
                padding: "9px 13px",
                height: 72,
                flexShrink: 0,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 7,
              }}
            >
              <span
                style={{
                  fontSize: 8,
                  letterSpacing: "0.22em",
                  color: "rgba(255,255,255,0.26)",
                  textTransform: "uppercase",
                  marginBottom: 5,
                  display: "flex",
                }}
              >
                Your Scene
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.72)",
                  fontStyle: "italic",
                  lineHeight: 1.45,
                  display: "flex",
                  flexWrap: "wrap",
                }}
              >
                "A young woman kneels before a weathered fox shrine deep in a
                cedar forest under moonlight"
              </span>
            </div>

            {/* Arrow */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "4px 0",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 9999,
                  background: PURPLE_D,
                }}
              >
                {/* Down arrow — drawn with borders */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <div
                    style={{
                      width: 1.5,
                      height: 6,
                      background: WHITE,
                      borderRadius: 1,
                      display: "flex",
                    }}
                  />
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderTop: `5px solid ${WHITE}`,
                      display: "flex",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Prompt rows */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
                padding: "0 17px 12px",
                flex: 1,
              }}
            >
              {ROW.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 9,
                    padding: "7px 11px",
                    borderRadius: 5,
                    background: r.bg,
                    borderLeft: `2px solid ${r.border}`,
                    flex: 1,
                    overflow: "hidden",
                  }}
                >
                  {/* Platform name + tier */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: 78,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: r.name,
                        display: "flex",
                      }}
                    >
                      {r.label}
                    </span>
                    <span
                      style={{
                        fontSize: 7.5,
                        letterSpacing: "0.10em",
                        color: "rgba(255,255,255,0.26)",
                        textTransform: "uppercase",
                        marginTop: 1,
                        display: "flex",
                      }}
                    >
                      {r.tier}
                    </span>
                  </div>
                  {/* Prompt text */}
                  <span
                    style={{
                      fontSize: 9.5,
                      color: "rgba(255,255,255,0.50)",
                      lineHeight: 1.5,
                      fontFamily: '"Courier New", monospace',
                      display: "flex",
                      flexWrap: "wrap",
                    }}
                  >
                    {PROMPTS[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA badge */}
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 14,
              right: 0,
              background: "linear-gradient(135deg,#7c3aed,#ec4899)",
              padding: "8px 18px",
              borderRadius: 28,
              fontSize: 12.5,
              fontWeight: 700,
              color: WHITE,
            }}
          >
            Try Free → promagen.com
          </div>
        </div>
      </div>
    </div>,
    {
      width: size.width,
      height: size.height,
    },
  );
}
