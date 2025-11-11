'use client';

import React from 'react';
// Note: ensure file exists at this path with this casing.
import ProgressProvider from '@/components/progress-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ProgressProvider>{children}</ProgressProvider>;
}

