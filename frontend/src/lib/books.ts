export type EntryStatus = "done" | "progress" | "todo";
export type BookEntry = { title: string; status?: EntryStatus; body?: string; };

// Edit these arrays; pages auto-update.
export const developersBook: BookEntry[] = [
  { title: "API /health", status: "done", body: "Bound to 0.0.0.0:3001 and returns 200." },
  { title: "Frontend App Router", status: "progress", body: "Wiring pages under /app/docs/* (TSX only)." },
  { title: "Provider registry (20 locked)", status: "todo", body: "Import into UI and wire selector." }
];

export const usersBook: BookEntry[] = [
  { title: "Homepage scaffolding", status: "progress", body: "Layout + sections being assembled." },
  { title: "Leaderboard explainer", status: "todo", body: "Short copy + helpful prompts." },
  { title: "Popular Prompt Grid", status: "todo", body: "Cards, likes, refine/remix flow." }
];

