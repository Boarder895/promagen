// C:\Users\Martin Yarnold\Projects\promagen\frontend\app\docs\history\diff\page.tsx
import libBooks from "@/lib/books"; // default import guarantees the right object

export default function Page() {
  const fromDate = new Date("2025-09-01");
  const toDate = new Date();

  // use the default import directly
  const entries = libBooks.historyBook.entries;

  const filtered = entries.filter((e) => {
    const d = new Date(e.date);
    return d >= fromDate && d <= toDate;
  });

  return <pre>{JSON.stringify(filtered, null, 2)}</pre>;
}
