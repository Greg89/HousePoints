import { z } from "zod";

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export type LogContext = Record<string, unknown>;

export const REDACTED_LOG_VALUE = "[REDACTED]";

const sensitiveLogKeyFragments = [
  "authorization",
  "clientsecret",
  "cookie",
  "idtoken",
  "invitetoken",
  "password",
  "refreshtoken",
  "secret",
  "token",
];

function isLogRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSensitiveLogKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return sensitiveLogKeyFragments.some((fragment) => normalized.includes(fragment));
}

export function redactLogContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => {
      if (isSensitiveLogKey(key)) {
        return [key, REDACTED_LOG_VALUE];
      }
      if (Array.isArray(value)) {
        return [
          key,
          value.map((item) => (isLogRecord(item) ? redactLogContext(item) : item)),
        ];
      }
      if (isLogRecord(value)) {
        return [key, redactLogContext(value)];
      }
      return [key, value];
    }),
  );
}

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
