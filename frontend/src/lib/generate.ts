// Demo generator (Option A). Matches your page's call signature:
//   const jobId = await startGeneration(p.id, prompt);

import type { ProviderId } from "@/lib/providers"

export type JobState = 'queued' | 'running' | 'ok' | 'error'

export type StartResponse = { jobId: string }

/** Start a generation job (stubbed) */
export async function startGeneration(provider: ProviderId, prompt: string): Promise<string> {
  // In a real integration you'd POST to your backend here.
  // We return a deterministic-ish id so progress can be tied to it.
  const jobId = `job_${provider}_${Date.now()}`
  return jobId
}

// Keep a compatible export name some code might use
export type GenerateRequest = { provider: ProviderId; prompt: string; userId?: string }
export type GenerateResponse = { jobId: string; provider: ProviderId; status: JobState; imageUrl?: string; error?: string }
export const generate = async (req: GenerateRequest): Promise<GenerateResponse> => ({
  jobId: await startGeneration(req.provider, req.prompt),
  provider: req.provider,
  status: 'queued'
})


