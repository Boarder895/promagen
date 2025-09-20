// src/pages/prompts/[id].tsx
import { GetServerSideProps } from "next";
import Head from "next/head";
import { useState } from "react";
import RunAcrossProvidersButton from "@/components/RunAcrossProvidersButton";

type Prompt = {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  likes?: number;
  remixes?: number;
  uses?: number;
  createdAt?: string;
  tags?: string[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:8080";

type PageProps = { prompt: Prompt };

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const id = ctx.params?.id as string;
  const res = await fetch(`${API_BASE}/prompts/${id}`);
  if (!res.ok) return { notFound: true };
  const prompt: Prompt = await res.json();
  return { props: { prompt } };
};

export default function PromptDetailPage({ prompt }: PageProps) {
  const [likes, setLikes] = useState(prompt.likes ?? 0);
  const [remixes, setRemixes] = useState(prompt.remixes ?? 0);
  const [uses, setUses] = useState(prompt.uses ?? 0);

  async function post(path: string) {
    const res = await fetch(`${API_BASE}${path}`, { method: "POST" });
    if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
    return res.json();
  }

  return (
    <>
      <Head>
        <title>{prompt.title} • Prompts</title>
      </Head>

      <main className="mx-auto max-w-3xl p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">{prompt.title}</h1>
          {prompt.summary && <p className="mt-2 text-gray-600">{prompt.summary}</p>}
        </header>

        {prompt.body && (
          <section className="rounded-xl border bg-white p-4">
            <pre className="whitespace-pre-wrap break-words text-sm">{prompt.body}</pre>
          </section>
        )}

        <section className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span>👍 {likes}</span>
          <span>🔁 {remixes}</span>
          <span>🚀 {uses}</span>
        </section>

        <section className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border px-3 py-1.5 hover:bg-gray-50"
            onClick={async () => {
              setLikes((v) => v + 1);
              try { await post(`/prompts/${prompt.id}/like`); } catch { setLikes((v) => v - 1); }
            }}
          >
            Like
          </button>

          <button
            className="rounded-xl border px-3 py-1.5 hover:bg-gray-50"
            onClick={async () => {
              setRemixes((v) => v + 1);
              try { await post(`/prompts/${prompt.id}/remix`); } catch { setRemixes((v) => v - 1); }
            }}
          >
            Remix
          </button>

          <button
            className="rounded-xl border px-3 py-1.5 hover:bg-gray-50"
            onClick={async () => {
              setUses((v) => v + 1);
              try { await post(`/prompts/${prompt.id}/use`); } catch { setUses((v) => v - 1); }
            }}
            title="Optional: only if your API exposes /use"
          >
            Use
          </button>

          <div className="ml-auto" />
          <RunAcrossProvidersButton prompt={prompt.body ?? prompt.summary ?? prompt.title} />
        </section>
      </main>
    </>
  );
}
