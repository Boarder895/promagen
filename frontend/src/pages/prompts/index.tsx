// src/pages/prompts/index.tsx
import Head from "next/head";
import PromptCard, { Prompt } from "@/components/PromptCard";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8080";

type PageProps = { prompts: Prompt[] };

export async function getServerSideProps() {
  const res = await fetch(`${API_BASE}/prompts`);
  const prompts: Prompt[] = res.ok ? await res.json() : [];
  return { props: { prompts } };
}

export default function PromptsIndex({ prompts }: PageProps) {
  return (
    <>
      <Head><title>Prompts â€¢ Promagen</title></Head>
      <main className="mx-auto max-w-6xl p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Prompts</h1>
        {prompts.length === 0 ? (
          <p className="text-gray-600">No prompts yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {prompts.map((p) => <PromptCard key={p.id} p={p} />)}
          </div>
        )}
      </main>
    </>
  );
}


