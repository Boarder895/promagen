import type { Metadata } from 'next';
import { BookmarkIcon, SaveIcon } from '@/components/ui/emoji';

export const metadata: Metadata = {
  title: 'Saved · Promagen',
  description: 'Saved prompts and builds.',
};

/**
 * Saved (paid) – placeholder until Stage 3 unlocks.
 */
export default function SavedPage() {
  return (
    <main role="main" className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
        <span className="inline-flex items-center">
          <BookmarkIcon className="mr-2 h-5 w-5" />
          <span>My Prompts</span>
          <span className="mx-2 text-white/40">/</span>
          <SaveIcon className="mr-2 h-5 w-5" />
          <span>Saved Builds</span>
        </span>
      </h1>

      <p
        className="card mt-4 border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200"
        aria-live="polite"
      >
        This feature arrives in Stage&nbsp;3 (paid). You will be able to save prompts, versions, and outputs here.
      </p>

      <section aria-labelledby="coming-soon" className="mt-8">
        <h2 id="coming-soon" className="text-sm font-semibold text-white/80">
          What will be included
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <li className="card p-4">
            <div className="text-sm font-medium">Prompt library</div>
            <p className="mt-1 text-xs text-white/70">Folders, tags, quick search.</p>
          </li>
          <li className="card p-4">
            <div className="text-sm font-medium">Version history</div>
            <p className="mt-1 text-xs text-white/70">Compare outputs and roll back.</p>
          </li>
          <li className="card p-4">
            <div className="text-sm font-medium">Builds</div>
            <p className="mt-1 text-xs text-white/70">Store code drops and artefacts.</p>
          </li>
          <li className="card p-4">
            <div className="text-sm font-medium">Privacy-safe analytics</div>
            <p className="mt-1 text-xs text-white/70">Track usage without collecting PII.</p>
          </li>
        </ul>
      </section>
    </main>
  );
}
