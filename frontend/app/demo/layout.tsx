import type { ReactNode } from 'react';
import Providers from '../_providers';

export default function DemoLayout({ children }: { children: ReactNode }) {
  // Wrap only the /demo subtree so useProgress() works there,
  // without touching the rest of the site.
  return <Providers>{children}</Providers>;
}
