// FRONTEND Ãƒâ€šÃ‚Â· NEXT.JS
// NEW FILE: src/lib/userBook.ts
// Named exports only (project rule)

export type UserVideo = {
  title: string;
  url: string;            // Full YouTube URL
  note?: string;          // Short context line shown under the link
};

export type UsersBookSection = {
  title: string;
  items: string[];
  tone: "green" | "yellow" | "red";
};

export type UsersBookData = {
  lastUpdatedISO: string;
  summary: string[];
  sections: UsersBookSection[];
  videos: UserVideo[];
  links: { label: string; href: string }[];
};

export const usersBookData: UsersBookData = {
  lastUpdatedISO: new Date().toISOString(),
  summary: [
    "Promagen is in active build. App Router pages live under /app/docs/*.",
    "Providers: canonical 20-platform list is locked (frontend is source of truth until launch).",
    "Backend API is Express/Prisma on Fly.io with /health at root; feature routes under /api/v1/*.",
    "Local ports standardised: UI 3000, API 3001.",
  ],
  sections: [
    {
      title: "ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ WhatÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s working now",
      tone: "green",
      items: [
        "Docs route owner locked to app/docs/* (TSX pages only).",
        "UsersÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Book (this page), DevelopersÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Book, History Book scaffolds in place.",
        "Build Progress Book route created and rendering.",
        "Frontend points at PROD API by default; .env.local can target local only when needed.",
        "Prisma singleton pattern locked; database URL via Fly secrets.",
        "Named exports only across lib/components; Next.js pages use default export as required.",
      ],
    },
    {
      title: "ÃƒÂ°Ã…Â¸Ã…Â¸Ã‚Â¡ In progress",
      tone: "yellow",
      items: [
        "UI polish to meet the ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“eye-pleasingÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ fundamentals (traffic lights, spacing, typography).",
        "Provider registry wiring on the frontend (src/lib/providers.ts + ProviderGrid).",
        "Helmet + CSP, rate limiting, Zod validation on the API.",
        "Slack alert webhook + Logtail redaction tightening.",
      ],
    },
    {
      title: "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â´ Not started / pending",
      tone: "red",
      items: [
        "Leaderboard hourly collectors + nightly full collectors with provenance.",
        "Popular Prompt Grid (likes, remix, SEO surface).",
        "Admin review UI with per-criterion overrides + snapshot deltas.",
        "WordPress embeds (public shortcode) + personalised iframe from app.promagen.com.",
      ],
    },
  ],
  videos: [
    // Replace these placeholders with your real YouTube URLs at any time.
    {
      title: "Promagen overview (work-in-progress)",
      url: "https://www.youtube.com/watch?v=VIDEO_ID_1",
      note: "High-level tour of the goals and current surface.",
    },
    {
      title: "Frontend docs routes tour (/app/docs/*)",
      url: "https://www.youtube.com/watch?v=VIDEO_ID_2",
      note: "Where the three books live and how to add pages.",
    },
    {
      title: "API health + deployment checks on Fly.io",
      url: "https://www.youtube.com/watch?v=VIDEO_ID_3",
      note: "0.0.0.0 binding, /health, release_command, logs.",
    },
  ],
  links: [
    { label: "DevelopersÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Book", href: "/docs/developers-book" },
    { label: "History Book", href: "/docs/history" },
    { label: "Build Progress Book", href: "/docs/build-progress-book" },
  ],
};



