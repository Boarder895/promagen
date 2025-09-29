import books from "@/data/books.json";

export default function BuildAudit() {
  const f = books.developersBook?.fundamentals || [];
  if (!f.length) return null;
  return (
    <section className="mt-8 text-sm opacity-80">
      <h3 className="font-semibold mb-2">6-Point Build Audit</h3>
      <ul className="list-disc pl-5 space-y-1">
        {f.map((line, i) => (<li key={i}>{line}</li>))}
      </ul>
    </section>
  );
}
