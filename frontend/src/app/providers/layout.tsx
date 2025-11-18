// src/app/providers/layout.tsx

import React from 'react';

type ProvidersLayoutProps = {
  children: React.ReactNode;
};

/**
 * Shared layout wrapper for all /providers routes.
 *
 * This keeps spacing and max-width consistent across:
 * - /providers
 * - /providers/[id]
 * - /providers/... subroutes (prompt builder, trends, etc.)
 *
 * Background + min-height are handled by the root layout + globals.css.
 */
export default function ProvidersLayout({ children }: ProvidersLayoutProps): JSX.Element {
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">{children}</div>;
}
