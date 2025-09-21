// src/app/prompts/layout.tsx
import { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Prompts',
};

export default function PromptsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
