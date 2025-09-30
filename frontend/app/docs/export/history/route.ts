// app/docs/export/history/route.ts
import { getBook, metaOf } from "@/lib/books";

/** Build a safe, trimmed payload for the History book. */
function buildHistoryPayload() {
  const history = getBook("history");

  // Use centralized safe accessor (no direct history.meta)
  const meta = metaOf(history);

  // Derive "version" from most recently updated section (if any).
  const mostRecent =
    [...history.sections].sort((a, b) => {
      const ad = a.lastUpdated ?? "";
      const bd = b.lastUpdated ?? "";
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    })[0] ?? null;

  return {
    id: "history",
    title: meta.title,
    subtitle: meta.subtitle ?? "",
    version: mostRecent?.lastUpdated ?? "",
    sections: history.sections.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      lastUpdated: s.lastUpdated ?? "",
    })),
    entries: (history.entries ?? []).map((e) => ({
      id: e.id,
      text: e.text,
      date: e.date ?? "",
    })),
  };
}

// Only route handlers are exported
export async function GET() {
  return Response.json(buildHistoryPayload());
}
