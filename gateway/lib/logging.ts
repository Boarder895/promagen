// gateway/lib/logging.ts

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
