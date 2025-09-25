import React from "react";
import PromptGrid from "@/components/prompts/PromptGrid";
import { type PromptQuery } from "@/lib/api";

export const revalidate = 60;

type PageProps = {
  searchParams?: Partial<Record<keyof PromptQuery, string>>;
};

export default function PromptsIndexPage({ searchParams }: PageProps) {
  const q: PromptQuery = {
    q: searchParams?.q,
    tag: searchParams?.tag,
    page: searchParams?.page ? Number(searchParams.page) : 1,
    pageSize: searchParams?.pageSize ? Number(searchParams.pageSize) : 20,
    sort: (searchParams?.sort as PromptQuery["sort"]) ?? "latest",
  };

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Community Prompts</h1>
      <PromptGrid query={q} />
    </main>
  );
}
