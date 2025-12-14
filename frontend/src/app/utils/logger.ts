// C:\Users\Proma\Projects\promagen\frontend\src\app\utils\logger.ts
//
// Tiny logger wrapper with levels + optional metadata.
//
// Lint rule in this repo only allows: console.debug / console.warn / console.error.
// So we intentionally map "info" → console.debug (same intent: visible trace without spamming).

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: unknown) {
  // Normalise: "info" is treated as "debug" for eslint no-console allow-list.
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()}: ${message}`;

  switch (level) {
    case 'warn': {
      if (meta !== undefined) console.warn(base, meta);
      else console.warn(base);
      return;
    }
    case 'error': {
      if (meta !== undefined) console.error(base, meta);
      else console.error(base);
      return;
    }
    case 'info':
    case 'debug':
    default: {
      if (meta !== undefined) console.debug(base, meta);
      else console.debug(base);
      return;
    }
  }
}

export const logger = {
  debug: (m: string, meta?: unknown) => emit('debug', m, meta),
  info: (m: string, meta?: unknown) => emit('info', m, meta),
  warn: (m: string, meta?: unknown) => emit('warn', m, meta),
  error: (m: string, meta?: unknown) => emit('error', m, meta),
};
