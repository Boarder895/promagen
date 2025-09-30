import { usePrompts, type Prompt } from "@/lib/hooks/usePrompts";

type PromptsProps = {
  title?: string;
  filter?: (p: Prompt) => boolean; // optional filter function
};

export default function Prompts({ title = "Latest", filter }: PromptsProps = {}) {
  const { data, loading, error } = usePrompts();

  const all: Prompt[] = data?.items ?? [];
  const filtered: Prompt[] = typeof filter === "function" ? all.filter(filter) : all;

  if (loading) return <div>Loading…</div>;
  if (error) return <div className="text-red-600">Failed: {error.message}</div>;
  if (!filtered.length) return <div>No prompts yet.</div>;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {filtered.map((p) => (
          <li key={p.id} className="p-3 rounded border">
            <div className="font-medium">
              {p.title ?? (p.text ? p.text.slice(0, 48) : p.id)}
            </div>
            {p.text ? <p className="text-sm opacity-70">{p.text}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}