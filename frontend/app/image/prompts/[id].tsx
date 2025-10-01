"use client";

import { useState } from "react";

type PageProps = { params: { id: string } };

export function ImagePromptPage({ params }: PageProps) {
  // Keep underscored until the editor UI uses it.
  const [_prompt, _setPrompt] = useState<string>("");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Image Prompt</h1>
      <p className="text-sm opacity-80">ID: {params.id}</p>
      {/* TODO: render prompt details / editor here */}
    </div>
  );
}
