// C:\Users\Proma\Projects\promagen\gateway\lib\resilience.ts

import { logError, logInfo } from './logging';

export type ResilienceOptions = {
  providerId: string;
  timeoutMs: number;
  retries: number; // number of retries AFTER the first attempt
  retryDelayMs: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Timeout after ${timeoutMs}ms (${label})`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// Retry + timeout wrapper
export async function withResilience<T>(
  fn: () => Promise<T>,
  options: ResilienceOptions,
): Promise<T> {
  const maxAttempts = 1 + Math.max(0, options.retries);
  let attempt = 1;

   
  while (true) {
    try {
      if (attempt > 1) {
        logInfo('Resilience retry', { providerId: options.providerId, attempt, maxAttempts });
      }

      const result = await withTimeout(fn(), options.timeoutMs, options.providerId);
      return result;
    } catch (err: unknown) {
      const msg = asErrorMessage(err);
      logError('Resilience attempt failed', {
        providerId: options.providerId,
        attempt,
        maxAttempts,
        error: msg,
      });

      if (attempt >= maxAttempts) throw err;

      await sleep(options.retryDelayMs);
      attempt += 1;
    }
  }
}
