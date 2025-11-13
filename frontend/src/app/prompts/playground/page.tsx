/**
 * Prompts Playground — placeholder page that compiles cleanly.
 * Replace with real playground logic later.
 */
export const metadata = {
  title: 'Prompts Playground · Promagen',
  description: 'Draft and test prompt ideas in a safe environment.',
};

type Sample = { id: string; title: string; prompt: string };

const samples: Sample[] = [
  { id: 's1', title: 'Homepage tone', prompt: 'Write a concise, confident headline for Promagen’s homepage.' },
  { id: 's2', title: 'Provider card', prompt: 'Summarise an AI provider card: name, score, trend, tags.' },
];

export default function PromptsPlaygroundPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Prompts Playground</h1>
      <p className="mt-3 text-sm text-white/75">
        A lightweight space to iterate on ideas. Nothing is stored.
      </p>

      <section aria-labelledby="samples" className="mt-8">
        <h2 id="samples" className="text-sm font-semibold text-white/80">Samples</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {samples.map(s => (
            <li key={s.id} className="rounded-2xl border border-white/10 p-4 hover:border-white/20">
              <div className="text-sm font-medium">{s.title}</div>
              <p className="mt-2 text-xs text-white/70">{s.prompt}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
