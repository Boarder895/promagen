// Admin jobs â€” frontend stub (Option A) aligned to your Admin UI.
// Adds `result?: { imageUrl?: string }` and keeps all previously added fields.

export type AdminJobState = 'queued' | 'running' | 'ok' | 'error'

export type AdminJob = {
  id: string
  provider?: string
  prompt?: string
  state: AdminJobState

  // Timeline fields
  startedAt: number                // when the job started
  createdAt: number                // legacy alias
  endedAt?: number

  // Progress / timings
  progress?: number                // 0..100 (your UI uses Math.round(progress))
  _progress?: number               // legacy alias (0..100)
  tookMs?: number
  toolsMs?: number

  // Result & error
  result?: { imageUrl?: string }   // your UI reads result.imageUrl
  imageUrl?: string                // legacy convenience (not used by your Admin page)
  error?: string
}

/** Demo rows with realistic shape */
function demoRows(): AdminJob[] {
  const now = Date.now()
  const mk = (n: number, state: AdminJobState, prog?: number, img?: string): AdminJob => {
    const startedAt = now - n * 10_000
    const endedAt = state === 'ok' ? startedAt + 2_000 : undefined
    const tookMs = endedAt ? endedAt - startedAt : undefined
    const toolsMs = endedAt ? Math.round((tookMs ?? 2000) * 0.4) : undefined
    return {
      id: `demo-${n}`,
      provider: n % 2 ? 'openai' : 'stability',
      prompt: 'demo',
      state,
      startedAt,
      createdAt: startedAt,
      endedAt,
      progress: prog,        // 0..100
      _progress: prog,       // keep alias
      tookMs,
      toolsMs,
      result: img ? { imageUrl: img } : undefined,
      imageUrl: img
    }
  }
  return [
    mk(3, 'ok', 100, 'https://placehold.co/256x256/png'),
    mk(2, 'running', 60),
    mk(1, 'ok', 100, 'https://placehold.co/256x256/png')
  ]
}

/** Core list (sorted newest first) */
export async function listJobs(limit?: number): Promise<AdminJob[]> {
  const rows = demoRows().sort((a, b) => b.startedAt - a.startedAt)
  return typeof limit === 'number' ? rows.slice(0, Math.max(0, limit)) : rows
}

/** Legacy alias used by the admin page */
export async function getRecentJobs(limit?: number): Promise<AdminJob[]> {
  return listJobs(limit)
}

/** Clear finished (no-op stub) */
export async function clearFinished(): Promise<{ cleared: number }> {
  return { cleared: 0 }
}

/** Optional helper */
export async function getJobById(id: string): Promise<AdminJob | null> {
  const all = await listJobs()
  return all.find(j => j.id === id) ?? null
}


