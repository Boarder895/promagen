import { NextResponse } from "next/server";
import { loadBooks } from "@/lib/books";

export async function GET() {
  const { history } = loadBooks();
  const sections = (history.sections ?? []).map((s: any) => ({
    id: s.id ?? "",
    title: s.title ?? "",
    status: (s.status ?? "").toLowerCase(),
    tags: Array.isArray(s.tags) ? s.tags : []
  }));
  return NextResponse.json({ book: "history", title: history.title, sections });
}
