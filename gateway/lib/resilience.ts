// C:\Users\Proma\Projects\promagen\gateway\lib\resilience.ts

import { logError, logInfo } from './logging';

// ----------------------------------------------
// Small sleep helper
// ----------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------
// Resilience wrapper: retry + exponential backoff
// ----------------------------------------------

export async function withResilience<T>(fn: () => Promise<T>): Promise<T> {
  const maxAttempts = 2;
  let attempt = 0;

  while (attempt <= maxAttempts) {
    try {
      if (attempt > 0) {
        logInfo(`Resilience: retry attempt #${attempt}`);
      }
      return await fn();
    } catch (err: any) {
      logError(`Resilience: attempt #${attempt} failed`, err?.message ?? err);

      if (attempt === maxAttempts) {
        throw err;
      }

      const delay = attempt === 0 ? 200 : 500;
      await sleep(delay);
      attempt++;
    }
  }

  // Should never hit
  throw new Error('Resilience: exhausted without returning');
}
