"use client";

import React, { createContext, useContext, useMemo, useReducer } from "react";

export type JobState = "queued" | "running" | "ok" | "error";
export type Job = {
  id: string;
  provider: string;
  label: string;
  state: JobState;
  progress?: number;   // 0–100 while running
  startedAt: number;
  endedAt?: number;
  tookMs?: number;
  error?: string;
};

type Action =
  | { type: "enqueue"; job: Job }
  | { type: "update"; id: string; patch: Partial<Job> }
  | { type: "clearFinished" };

function reducer(state: Job[], action: Action): Job[] {
  switch (action.type) {
    case "enqueue":
      return [action.job, ...state].slice(0, 50);
    case "update":
      return state.map((j) => (j.id === action.id ? { ...j, ...action.patch } : j));
    case "clearFinished":
      return state.filter((j) => j.state === "queued" || j.state === "running");
    default:
      return state;
  }
}

const Ctx = createContext<{
  jobs: Job[];
  enqueue: (job: Job) => void;
  update: (id: string, patch: Partial<Job>) => void;
  clearFinished: () => void;
} | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [jobs, dispatch] = useReducer(reducer, [] as Job[]);
  const value = useMemo(
    () => ({
      jobs,
      enqueue: (job: Job) => dispatch({ type: "enqueue", job }),
      update: (id: string, patch: Partial<Job>) => dispatch({ type: "update", id, patch }),
      clearFinished: () => dispatch({ type: "clearFinished" }),
    }),
    [jobs]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProgress() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProgress must be used inside <ProgressProvider/>");
  return ctx;
}
