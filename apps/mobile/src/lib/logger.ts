/**
 * Structured client-side logger. Mirrors the JSON-per-line format used by the
 * API + web workspaces so client breadcrumbs stay parseable when we start
 * shipping them to SEQ via a client-error endpoint.
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function emit(level: LogLevel, event: string, context: LogContext): void {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    service: "housepoints-mobile",
    ...context,
  };
  const line = JSON.stringify(payload);
  const target = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  target(line);
}

export const logger = {
  debug(event: string, context: LogContext = {}): void {
    emit("debug", event, context);
  },
  info(event: string, context: LogContext = {}): void {
    emit("info", event, context);
  },
  warn(event: string, context: LogContext = {}): void {
    emit("warn", event, context);
  },
  error(event: string, context: LogContext = {}): void {
    emit("error", event, context);
  },
};

export function serializeError(err: unknown): LogContext {
  if (err instanceof Error) {
    return { errorName: err.name, errorMessage: err.message };
  }
  return { errorMessage: String(err) };
}
