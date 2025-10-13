import { EventEmitter } from "events";

export type JobState = "queued" | "running" | "ok" | "error";

export type Job = {
  id: string;
  provider: string;
  state: JobState;
  progress: number;      // 0..100
  startedAt?: number;
  endedAt?: number;
  error?: string;
  tookMs?: number;
  // arbitrary result payload (e.g., imageUrl)
  result?: Record<string, unknown>;
};

export class JobStore {
  private jobs = new Map<string, Job>();
  private chans = new Map<string, EventEmitter>();

  // --- events ---------------------------------------------------------------
  private ensureChan(id: string) {
    let ch = this.chans.get(id);
    if (!ch) { ch = new EventEmitter(); this.chans.set(id, ch); }
    return ch;
  }
  on(id: string, fn: (ev: any) => void) { this.ensureChan(id).on("msg", fn); }
  off(id: string, fn: (ev: any) => void) { this.chans.get(id)?.off("msg", fn); }
  private emit(id: string, ev: any) { this.chans.get(id)?.emit("msg", ev); }

  // --- job lifecycle --------------------------------------------------------
  get(id: string) { return this.jobs.get(id) || null; }
  private set(job: Job) { this.jobs.set(job.id, job); this.emit(job.id, { type: "update", job }); }

  create(provider: string) {
    const id = `${provider}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const job: Job = { id, provider, state: "queued", progress: 0 };
    this.set(job);
    return job;
  }

  start(id: string) {
    const j = this.get(id); if (!j) return;
    j.state = "running"; j.startedAt = Date.now(); this.set(j);
  }

  setProgress(id: string, pct: number) {
    const j = this.get(id); if (!j) return;
    j.progress = Math.max(0, Math.min(100, Math.round(pct))); this.set(j);
  }

  finishOk(id: string, result?: Record<string, unknown>) {
    const j = this.get(id); if (!j) return;
    j.state = "ok"; j.progress = 100; j.endedAt = Date.now();
    j.tookMs = j.startedAt ? j.endedAt - j.startedAt : undefined;
    if (result) j.result = result;
    this.set(j);
  }

  finishError(id: string, message: string) {
    const j = this.get(id); if (!j) return;
    j.state = "error"; j.error = message; j.endedAt = Date.now();
    j.tookMs = j.startedAt ? j.endedAt - j.startedAt : undefined;
    this.set(j);
  }

  // one-shot helper for simulated runs (kept for demos)
  async simulate(id: string, durationMs = 4000, failureRate = 0.08) {
    this.start(id);
    const tick = Math.max(80, Math.floor(durationMs / 40));
    const int = setInterval(() => {
      const j = this.get(id);
      if (!j || j.state !== "running") { clearInterval(int); return; }
      this.setProgress(id, Math.min(100, (j.progress ?? 0) + (2 + Math.floor(Math.random() * 5))));
    }, tick);
    await new Promise(r => setTimeout(r, durationMs));
    clearInterval(int);
    if (Math.random() < failureRate) this.finishError(id, "Simulated provider error");
    else this.finishOk(id);
  }

  // NEW: recent jobs (newest first)
  list(limit = 50): Job[] {
    const all = Array.from(this.jobs.values());
    const slice = all.slice(Math.max(0, all.length - limit));
    return slice.reverse();
  }
}

