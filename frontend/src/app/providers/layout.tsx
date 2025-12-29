// src/app/providers/layout.tsx

import React from 'react';

type ProvidersLayoutProps = {
  children: React.ReactNode;
};

/**
 * Shared layout wrapper for all /providers routes.
 *
 * Pass-through layout: individual pages handle their own layout needs.
 * - /providers/[id] uses HomepageGrid (full-page layout)
 * - Other pages have their own <main> wrappers
 *
 * Background + min-height are handled by the root layout + globals.css.
 */
export default function ProvidersLayout({ children }: ProvidersLayoutProps): JSX.Element {
  return <>{children}</>;
}
