"use client";

import SSEGrid from "./sse-grid";

const PROVIDERS: Array<{ id: string; name: string }> = [
  { id: "openai", name: "OpenAI DALL·E/GPT-Image" },
  { id: "stability", name: "Stability AI" },
  { id: "leonardo", name: "Leonardo AI" },
  { id: "i23rf", name: "I23RF" },
  { id: "artistly", name: "Artistly" },
  { id: "adobe", name: "Adobe Firefly" },
  { id: "midjourney", name: "Midjourney" },
  { id: "canva", name: "Canva Text-to-Image" },
  { id: "bing", name: "Bing Image Creator" },
  { id: "ideogram", name: "Ideogram" },
  { id: "picsart", name: "Picsart" },
  { id: "fotor", name: "Fotor" },
  { id: "nightcafe", name: "NightCafe" },
  { id: "playground", name: "Playground AI" },
  { id: "pixlr", name: "Pixlr" },
  { id: "deepai", name: "DeepAI" },
  { id: "novelai", name: "NovelAI" },
  { id: "lexica", name: "Lexica" },
  { id: "openart", name: "OpenArt" },
  { id: "flux", name: "Flux Schnell" },
];

export default function SSEPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Demo · SSE Job Progress</h1>
      <p className="opacity-80">
        Starts a job per provider, streams progress via Server-Sent Events, and updates
        per-tile bars plus the global toast.
      </p>
      <SSEGrid providers={PROVIDERS} />
    </main>
  );
}
