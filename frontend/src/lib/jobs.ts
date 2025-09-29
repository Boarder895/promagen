// Jobs streaming simulator for demos (Option A).
// - startJob(providerId, { durationMs?, failureRate? }) -> jobId
// - streamJob(jobId, onEvent) -> stop()
// Exports JobEvent used by demo pages.

export type JobState = 'queued' | 'running' | 'ok' | 'error'

export type JobPayload = {
  id: string
  provider?: string
  state: JobState
  progress: number            // 0..100
  result?: { imageUrl?: string }
  tookMs?: number
  endedAt?: number
  error?: string
}

export type JobEvent = { type: 'update'; job: JobPayload }

type StartOpts = {
  durationMs?: number       // total simulated time
  failureRate?: number      // 0..1 probability of error near the end
}

// In-memory options per job so streamJob can read them.
const _jobOpts = new Map<string, Required<StartOpts>>()

/** Start a job; returns a generated job id. */
export async function startJob(
  providerId: string,
  opts: StartOpts = {}
): Promise<string> {
  const jobId = `job_${providerId}_${Date.now()}`
  _jobOpts.set(jobId, {
    durationMs: Math.max(400, Math.floor(opts.durationMs ?? 1600)),
    failureRate: Math.min(1, Math.max(0, opts.failureRate ?? 0.05)),
  })
  return jobId
}

/**
 * Simulated SSE-like stream. Calls onEvent with progress updates and final result.
 * Returns a stop() function to cancel further updates.
 */
export function streamJob(jobId: string, onEvent: (ev: JobEvent) => void): () => void {
  let stopped = false
  const started = Date.now()
  const { durationMs, failureRate } = _jobOpts.get(jobId) ?? { durationMs: 1600, failureRate: 0.05 }

  // immediate "queued" tick
  onEvent({
    type: 'update',
    job: { id: jobId, state: 'queued', progress: 0 }
  })

  let timer: any = null

  function tick() {
    if (stopped) return
    const now = Date.now()
    const elapsed = now - started
    const pct = Math.min(100, Math.round((elapsed / durationMs) * 100))

    const nearEnd = pct >= 95
    const willFail = nearEnd && Math.random() < failureRate

    if (willFail) {
      const payload: JobPayload = {
        id: jobId,
        state: 'error',
        progress: pct,
        endedAt: now,
        tookMs: now - started,
        error: 'Simulated failure'
      }
      onEvent({ type: 'update', job: payload })
      clear()
      return
    }

    const final = pct >= 100
    const payload: JobPayload = {
      id: jobId,
      state: final ? 'ok' : (pct === 0 ? 'queued' : 'running'),
      progress: pct,
      endedAt: final ? now : undefined,
      tookMs: final ? now - started : undefined,
      result: final ? { imageUrl: 'https://placehold.co/1024x1024/png' } : undefined
    }

    onEvent({ type: 'update', job: payload })

    if (!final) {
      schedule()
    } else {
      clear()
    }
  }

  function schedule() {
    // smooth-ish cadence
    timer = setTimeout(tick, 150)
  }

  function clear() {
    if (timer) clearTimeout(timer)
    _jobOpts.delete(jobId)
  }

  schedule()

  return () => {
    stopped = true
    clear()
  }
}
