import { NextResponse } from "next/server";
import { loadBooks } from "@/lib/books";

export async function GET() {
  const { developers } = loadBooks();
  // export simple shape; adjust later if you add fields
  const sections = (developers.sections ?? []).map((s: any) => ({
    id: s.id ?? "",
    title: s.title ?? "",
    status: (s.status ?? "").toLowerCase(),
    tags: Array.isArray(s.tags) ? s.tags : []
  }));
  return NextResponse.json({ book: "developers", title: developers.title, sections });
}
