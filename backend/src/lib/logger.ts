type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|api[-_]?key/i;

function redact(value: unknown, key = ''): unknown {
  if (sensitiveKeyPattern.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, redact(nestedValue, nestedKey)])
    );
  }
  return value;
}

function write(level: LogLevel, event: string, fields: LogFields = {}): void {
  const safeFields = redact(fields) as LogFields;
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields,
  });
  const destination = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  destination(payload);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => write('debug', event, fields),
  info: (event: string, fields?: LogFields) => write('info', event, fields),
  warn: (event: string, fields?: LogFields) => write('warn', event, fields),
  error: (event: string, fields?: LogFields) => write('error', event, fields),
};
