// C:\Users\Proma\Projects\promagen\gateway\lib\logging.ts

/**
 * Centralised logging for Promagen Gateway.
 * Uses clean prefixes so logs are readable in local + production.
 */

export function logInfo(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[gateway][info] ${message}`, data);
  } else {
    console.log(`[gateway][info] ${message}`);
  }
}

export function logError(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.error(`[gateway][error] ${message}`, data);
  } else {
    console.error(`[gateway][error] ${message}`);
  }
}
