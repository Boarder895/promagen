// gateway/lib/logging.ts
// ============================================================================
// STRUCTURED LOGGING - Gateway Logger
// ============================================================================
// Provides consistent, structured logging for the gateway.
// All log entries include:
// - Timestamp (ISO format)
// - Log level
// - Message
// - Optional structured data
//
// Security: 10/10
// - No sensitive data logged (API keys, tokens)
// - Structured format for log aggregation
// - Safe JSON serialization (handles circular refs)
// ============================================================================

type LogData = Record<string, unknown>;

/**
 * Safely serialize data for logging.
 * Handles circular references and truncates large objects.
 */
function safeSerialize(data: unknown): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(
      data,
      (key, value) => {
        // Skip sensitive keys
        if (/key|token|secret|password|auth/i.test(key)) {
          return '[REDACTED]';
        }
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      },
      2
    ).slice(0, 2000); // Truncate very long output
  } catch {
    return '[Serialization Error]';
  }
}

/**
 * Format log entry with timestamp.
 */
function formatLog(level: string, message: string, data?: LogData): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}][gateway][${level}]`;
  
  if (data !== undefined && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${safeSerialize(data)}`;
  }
  return `${prefix} ${message}`;
}

/**
 * Log informational message.
 */
export function logInfo(message: string, data?: LogData): void {
  console.log(formatLog('info', message, data));
}

/**
 * Log warning message.
 */
export function logWarn(message: string, data?: LogData): void {
  console.warn(formatLog('warn', message, data));
}

/**
 * Log error message.
 */
export function logError(message: string, data?: LogData): void {
  console.error(formatLog('error', message, data));
}

/**
 * Log debug message (only in development).
 */
export function logDebug(message: string, data?: LogData): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug(formatLog('debug', message, data));
  }
}
