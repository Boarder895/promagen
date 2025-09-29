'use client'

import * as React from 'react'
import { startGeneration } from '@/lib/generate'
import { streamJob, type JobEvent } from '@/lib/jobs'

type Provider = { id: string; name: string }

type LocalState = Record<
  string,
  { state: 'idle' | 'queued' | 'running' | 'ok' | 'error'; progress: number; url?: string; error?: string }
>

export default function RunGrid({ providers }: { providers: Provider[] }) {
  const [prompt, setPrompt] = React.useState('a luminous mushroom town at sunset, cinematic, ultra detailed')
  const [local, setLocal] = React.useState<LocalState>({})

  async function runOne(p: Provider) {
    setLocal(s => ({ ...s, [p.id]: { state: 'queued', progress: 0 } }))
    const jobId = await startGeneration(p.id as any, prompt)

    const stop = streamJob(jobId, (ev: JobEvent) => {
      const j = ev.job
      setLocal(s => ({
        ...s,
        [p.id]: {
          state: j.state,
          progress: j.progress ?? 0,
          url: j.result?.imageUrl,
          error: j.error,
        },
      }))
      if (j.state === 'ok' || j.state === 'error') stop()
    })
  }

  function runAll() {
    providers.forEach(runOne)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <label className="block text-sm font-medium">Prompt</label>
        <textarea
          className="w-full rounded-xl border p-3"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex gap-3">
          <button onClick={runAll} className="rounded-xl border px-4 py-2 hover:bg-gray-50">
            Run All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {providers.map((p) => {
          const st = local[p.id]?.state ?? 'idle'
          const pr = local[p.id]?.progress ?? 0
          const url = local[p.id]?.url
          const err = local[p.id]?.error

          return (
            <div key={p.id} className="rounded-2xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{p.name}</div>
              </div>

              <button
                className="w-full rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={st === 'queued' || st === 'running'}
                onClick={() => runOne(p)}
              >
                {st === 'queued' || st === 'running' ? 'Generating…' : 'Run'}
              </button>

              {st !== 'idle' && (
                <>
                  <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                    <div className="h-2 bg-black/70" style={{ width: `${Math.round(pr)}%` }} />
                  </div>
                  <div className="text-xs opacity-70">{Math.round(pr)}%</div>
                </>
              )}

              {st === 'ok' && url && (
                <a className="block text-sm underline break-all" href={url} target="_blank" rel="noreferrer">
                  Open result
                </a>
              )}

              {st === 'error' && err && <div className="text-xs text-red-600 break-all">{err}</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
