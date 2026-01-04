// src/app/providers/[id]/prompt-builder/layout.tsx

import React from 'react';

type PromptBuilderLayoutProps = {
  children: React.ReactNode;
};

/**
 * Dedicated studio layout for the per-provider prompt builder.
 *
 * Owns:
 * - The main landmark
 * - The canvas padding
 * - The centred content container
 * - Height constraint for internal scrolling
 *
 * The page.tsx file only needs to find the provider and render <PromptBuilder />.
 */
export default function ProviderPromptBuilderLayout({
  children,
}: PromptBuilderLayoutProps): JSX.Element {
  return (
    <main 
      role="main" 
      aria-label="Prompt builder" 
      className="h-dvh overflow-hidden"
    >
      <div className="mx-auto h-full max-w-5xl px-4 py-4">
        {children}
      </div>
    </main>
  );
}
