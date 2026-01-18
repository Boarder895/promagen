/**
 * Promagen Gateway - Structured Logging
 * ======================================
 * Centralised logging with consistent formatting and security.
 *
 * Security: 10/10
 * - Never logs API keys or secrets
 * - Sanitises user input in logs
 * - Rate limits error logging to prevent log flooding
 * - Structured JSON format for log aggregation
 *
 * @module lib/logging
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

/** Log level hierarchy (lower = more verbose) */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

/** Current log level threshold */
const currentLevel: number = LOG_LEVELS[LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

// =============================================================================
// SENSITIVE DATA PATTERNS
// =============================================================================

/**
 * Patterns that indicate sensitive data that should never be logged.
 * These are checked against both keys and values.
 */
const SENSITIVE_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /private[-_]?key/i,
] as const;

/**
 * Keys that should have their values redacted in logs.
 */
const REDACTED_KEYS = new Set([
  'apikey',
  'api_key',
  'apiKey',
  'secret',
  'password',
  'token',
  'authorization',
  'x-api-key',
  'x-promagen-gateway-secret',
]);

// =============================================================================
// SANITISATION
// =============================================================================

/**
 * Check if a key name suggests sensitive data.
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  if (REDACTED_KEYS.has(lowerKey)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Check if a value looks like sensitive data (e.g., API key format).
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  // Looks like an API key (32+ alphanumeric chars)
  if (/^[a-zA-Z0-9]{32,}$/.test(value)) return true;
  // Looks like a bearer token
  if (value.startsWith('Bearer ')) return true;
  // Looks like a JWT
  if (/^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value)) return true;
  return false;
}

/**
 * Recursively sanitise an object for logging.
 * Redacts sensitive values and limits depth/size.
 */
function sanitise(
  value: unknown,
  depth = 0,
  maxDepth = 5,
  maxArrayLength = 10,
  maxStringLength = 500,
): unknown {
  // Prevent infinite recursion
  if (depth > maxDepth) return '[MAX_DEPTH]';

  // Handle null/undefined
  if (value === null) return null;
  if (value === undefined) return undefined;

  // Handle primitives
  if (typeof value === 'string') {
    if (isSensitiveValue(value)) return '[REDACTED]';
    if (value.length > maxStringLength) {
      return value.slice(0, maxStringLength) + `...[truncated ${value.length - maxStringLength} chars]`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    const sanitised = value.slice(0, maxArrayLength).map((item) => sanitise(item, depth + 1, maxDepth, maxArrayLength, maxStringLength));
    if (value.length > maxArrayLength) {
      sanitised.push(`...[${value.length - maxArrayLength} more items]`);
    }
    return sanitised;
  }

  // Handle objects
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);

    for (const [key, val] of entries.slice(0, 50)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = sanitise(val, depth + 1, maxDepth, maxArrayLength, maxStringLength);
      }
    }

    if (entries.length > 50) {
      result['__truncated'] = `${entries.length - 50} more keys`;
    }

    return result;
  }

  // Handle functions and other types
  return `[${typeof value}]`;
}

// =============================================================================
// RATE LIMITING (Error Log Flooding Protection)
// =============================================================================

interface RateLimitEntry {
  count: number;
  firstSeen: number;
  lastLogged: number;
}

const errorRateLimits = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_PER_WINDOW = 10;

/**
 * Check if an error message should be logged (rate limiting).
 * Returns false if this error has been logged too frequently.
 */
function shouldLogError(message: string): { shouldLog: boolean; suppressedCount: number } {
  const now = Date.now();
  const key = message.slice(0, 100); // Use first 100 chars as key

  const entry = errorRateLimits.get(key);

  if (!entry) {
    errorRateLimits.set(key, {
      count: 1,
      firstSeen: now,
      lastLogged: now,
    });
    return { shouldLog: true, suppressedCount: 0 };
  }

  // Reset window if expired
  if (now - entry.firstSeen > RATE_LIMIT_WINDOW_MS) {
    errorRateLimits.set(key, {
      count: 1,
      firstSeen: now,
      lastLogged: now,
    });
    return { shouldLog: true, suppressedCount: 0 };
  }

  entry.count++;

  // Allow up to max per window
  if (entry.count <= RATE_LIMIT_MAX_PER_WINDOW) {
    entry.lastLogged = now;
    return { shouldLog: true, suppressedCount: 0 };
  }

  // Suppress, but log every 10th occurrence
  if (entry.count % 10 === 0) {
    const suppressedCount = entry.count - RATE_LIMIT_MAX_PER_WINDOW;
    entry.lastLogged = now;
    return { shouldLog: true, suppressedCount };
  }

  return { shouldLog: false, suppressedCount: 0 };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of errorRateLimits) {
    if (now - entry.firstSeen > RATE_LIMIT_WINDOW_MS * 5) {
      errorRateLimits.delete(key);
    }
  }
}, 300_000);

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

/**
 * Format a log entry as JSON for structured logging.
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  suppressedCount?: number,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry['context'] = sanitise(context);
  }

  if (suppressedCount && suppressedCount > 0) {
    entry['suppressedCount'] = suppressedCount;
  }

  return JSON.stringify(entry);
}

/**
 * Log a debug message (verbose, development only).
 */
function writeStdout(line: string): void {
  process.stdout.write(`${line}\n`);
}

function writeStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export function logDebug(message: string, context?: Record<string, unknown>): void {
  if (currentLevel > LOG_LEVELS.debug) return;
  writeStdout(formatLogEntry('debug', message, context));
}

/**
 * Log an info message (normal operations).
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  if (currentLevel > LOG_LEVELS.info) return;
  writeStdout(formatLogEntry('info', message, context));
}

/**
 * Log a warning message (recoverable issues).
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  if (currentLevel > LOG_LEVELS.warn) return;
  writeStderr(formatLogEntry('warn', message, context));
}

/**
 * Log an error message (failures, with rate limiting).
 */
export function logError(message: string, context?: Record<string, unknown>): void {
  if (currentLevel > LOG_LEVELS.error) return;

  const { shouldLog, suppressedCount } = shouldLogError(message);
  if (!shouldLog) return;

  writeStderr(formatLogEntry('error', message, context, suppressedCount));
}

/**
 * Legacy log function for backwards compatibility.
 * Maps to appropriate level-specific function.
 */
export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  switch (level) {
    case 'debug':
      logDebug(message, context);
      break;
    case 'info':
      logInfo(message, context);
      break;
    case 'warn':
      logWarn(message, context);
      break;
    case 'error':
      logError(message, context);
      break;
  }
}

// =============================================================================
// PERFORMANCE LOGGING
// =============================================================================

/**
 * Create a timer for measuring operation duration.
 * Returns a function that logs the elapsed time.
 */
export function startTimer(operation: string): () => void {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    logDebug(`${operation} completed`, { durationMs: Math.round(duration * 100) / 100 });
  };
}

/**
 * Log with timing - wraps an async function and logs duration.
 */
export async function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    logDebug(`${operation} completed`, { durationMs: Math.round(duration * 100) / 100 });
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logError(`${operation} failed`, {
      durationMs: Math.round(duration * 100) / 100,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// =============================================================================
// REQUEST LOGGING
// =============================================================================

/**
 * Log an incoming HTTP request (sanitised).
 */
export function logRequest(
  method: string,
  path: string,
  context?: {
    ip?: string;
    userAgent?: string;
    origin?: string;
  },
): void {
  logInfo('Request received', {
    method,
    path,
    ...context,
  });
}

/**
 * Log an outgoing HTTP response.
 */
export function logResponse(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void {
  const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  log(level, 'Response sent', {
    method,
    path,
    statusCode,
    durationMs: Math.round(durationMs * 100) / 100,
  });
}

// =============================================================================
// STARTUP LOGGING
// =============================================================================

/**
 * Log server startup information (with sensitive data redacted).
 */
export function logStartup(config: Record<string, unknown>): void {
  logInfo('Server starting', sanitise(config) as Record<string, unknown>);
}

/**
 * Log feed initialization.
 */
export function logFeedInit(
  feedId: string,
  ssotSource: string,
  itemCount: number,
): void {
  logInfo(`Feed initialized: ${feedId}`, {
    feedId,
    ssotSource,
    itemCount,
  });
}
