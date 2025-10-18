"use client";
import React from "react";
export type Prompt = { id: string; title: string; text: string };
export default function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <article className="rounded-md border p-2">
      <h3 className="font-medium">{prompt.title}</h3>
      <pre className="text-xs whitespace-pre-wrap">{prompt.text}</pre>
    </article>
  );
}




