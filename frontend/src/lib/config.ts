// src/lib/config.ts
// Single place to tune timings, jitter, animation durations, volumes.

export const PULSE = {
  beatIntervalMs: 1000,              // 1Hz when any market open
  minuteGlintEveryBeats: 60,         // glint once per minute
  easing: 0.08,                      // MOF easing factor 0..1
};

export const REFRESH = {
  exchangesOpenMs: 60_000,           // 60s when any market open
  exchangesClosedMs: 90_000,         // 90s when all closed
  providersOpenMs: 10 * 60_000,      // 10m when any open
  providersClosedMs: 15 * 60_000,    // 15m when all closed
  jitterOpenPct: 0.10,               // Ã‚Â±10%
  jitterClosedPct: 0.15,             // Ã‚Â±15%
};

export const UI = {
  maxDesktopHeightPx: 720,           // target fit (1366Ãƒâ€”768 screens)
  // Separate volumes so you can make the close a touch softer
  chimeVolumeOpen: 0.50,
  chimeVolumeClose: 0.40,
  // NEW: prevent bell Ã¢â‚¬Å“chorusÃ¢â‚¬Â when multiple markets flip together
  chimeCooldownMs: 2000,             // ignore same-type plays within this window
  skeletonMs: 600,
  heatBreathMs: 2200,
  glintMs: 450,
  sinceYouLookedUnderlineMs: 12_000,
};

export const ACCESSIBILITY = {
  respectReducedMotion: true,
  respectReducedSound: true,
};

export const BRANDS = {
  affiliateDisclosureText:
    "We use affiliate links. We may earn a commission. This keeps Promagen free for you.",
};

