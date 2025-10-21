export type Job = { id: string; name: string; state: "queued" | "running" | "done" | "failed" };
export function createJob(name: string): Job {
  return { id: crypto.randomUUID(), name, state: "queued" };
}


