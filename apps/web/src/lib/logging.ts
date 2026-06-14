type WebLogLevel = "info" | "warn" | "error";

export type WebLogEvent =
  | "web.action.invoked"
  | "web.action.completed"
  | "web.action.failed"
  | "web.auth.not_configured"
  | "web.auth.session_missing"
  | "web.session.read"
  | "web.user.mapping_ensured"
  | "web.user.mapping_failed"
  | "web.user.house_unassigned"
  | "web.admin.forbidden"
  | "web.admin.context_loaded"
  | "web.admin.context_failed"
  | "web.admin.house_created"
  | "web.admin.house_create_failed"
  | "web.admin.user_assigned"
  | "web.admin.assignment_failed"
  | "points.adjust.requested"
  | "points.adjust.completed"
  | "web.profile.updated"
  | "web.profile.update_failed";

type LogContext = Record<string, unknown>;

function write(level: WebLogLevel, event: WebLogEvent, context: LogContext = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME ?? "housepoints-web",
    env: process.env.NODE_ENV ?? "development",
    event,
    ...context,
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export function logInfo(event: WebLogEvent, context: LogContext = {}): void {
  write("info", event, context);
}

export function logWarn(event: WebLogEvent, context: LogContext = {}): void {
  write("warn", event, context);
}

export function logError(event: WebLogEvent, context: LogContext = {}): void {
  write("error", event, context);
}
