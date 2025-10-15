'use client';

import React from 'react';

export type Job = {
  id: string;
  label?: string;
  status?: string;
  progress?: number; // 0..100
};

type ProgressContextValue = {
  jobs: Job[];
  push: (job: Job) => void;
  update: (id: string, patch: Partial<Job>) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const ProgressCtx = React.createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = React.useState<Job[]>([]);

  const push = React.useCallback((job: Job) => {
    setJobs((xs) => {
      const i = xs.findIndex((j) => j.id === job.id);
      if (i >= 0) {
        const copy = xs.slice();
        copy[i] = { ...copy[i], ...job };
        return copy;
      }
      return [job, ...xs].slice(0, 25);
    });
  }, []);

  const update = React.useCallback((id: string, patch: Partial<Job>) => {
    setJobs((xs) => xs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const remove = React.useCallback((id: string) => {
    setJobs((xs) => xs.filter((j) => j.id !== id));
  }, []);

  const clear = React.useCallback(() => setJobs([]), []);

  const value = React.useMemo<ProgressContextValue>(
    () => ({ jobs, push, update, remove, clear }),
    [jobs, push, update, remove, clear]
  );

  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

// Default export is the hook, so `import useProgress from './ProgressProvider'` works.
export default function useProgress() {
  const ctx = React.useContext(ProgressCtx);
  if (!ctx) throw new Error('useProgress must be used within <ProgressProvider>');
  return ctx;
}
