// Tiny logger wrapper with levels + optional metadata
type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, msg: string, meta?: unknown) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()}: ${msg}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level === 'warn' ? 'warn' : level](base, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level === 'warn' ? 'warn' : level](base);
  }
}

export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};




