import { BookmarkIcon, SaveIcon } from "@/components/ui/emoji";

export default function SavedPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-100">
        <BookmarkIcon className="mr-2" /> My Prompts &nbsp;/&nbsp; <SaveIcon /> Saved Builds
      </h1>
      <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        This feature arrives in Stage&nbsp;3 (paid). You’ll be able to save prompts, versions, and outputs here.
      </p>
    </main>
  );
}

