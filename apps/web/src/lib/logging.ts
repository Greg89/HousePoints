type WebLogLevel = "info" | "warn" | "error";

export type WebLogEvent =
  | "web.action.invoked"
  | "web.action.completed"
  | "web.action.failed"
  | "web.dashboard.render_started"
  | "web.dashboard.render_completed"
  | "web.dashboard.render_failed"
  | "web.request.failed"
  | "web.auth.not_configured"
  | "web.auth.session_missing"
  | "web.auth.access_token_expired"
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

export function serializeErrorForLog(error: unknown): LogContext {
  if (!(error instanceof Error)) {
    return {
      errorType: typeof error,
      errorMessage: String(error),
    };
  }

  const errorWithMetadata = error as Error & {
    cause?: unknown;
    code?: unknown;
    digest?: unknown;
    statusCode?: unknown;
  };

  const context: LogContext = {
    errorName: error.name,
    errorMessage: error.message,
  };

  if (typeof errorWithMetadata.code === "string") {
    context.errorCode = errorWithMetadata.code;
  }

  if (typeof errorWithMetadata.statusCode === "number") {
    context.statusCode = errorWithMetadata.statusCode;
  }

  if (typeof errorWithMetadata.digest === "string") {
    context.digest = errorWithMetadata.digest;
  }

  if (errorWithMetadata.cause instanceof Error) {
    context.causeName = errorWithMetadata.cause.name;
    context.causeMessage = errorWithMetadata.cause.message;
  }

  return context;
}

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
