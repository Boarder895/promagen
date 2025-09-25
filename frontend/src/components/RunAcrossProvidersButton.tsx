"use client";

import React from "react";
import openAllProviders from "@/lib/openAllProviders";

export default function RunAcrossProvidersButton({ prompt }: { prompt: string }) {
  return (
    <button
      type="button"
      className="px-3 py-2 border rounded"
      onClick={() => openAllProviders(prompt)}
    >
      Open across providers
    </button>
  );
}
