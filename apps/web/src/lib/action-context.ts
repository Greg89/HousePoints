import "server-only";

import { randomUUID } from "node:crypto";
import { ApiResponseError, WebAuthenticationError } from "@/lib/api-client";
import {
  logError,
  logInfo,
  logWarn,
  serializeErrorForLog,
  type LogContext,
} from "@/lib/logging";

export type ServerActionContext = {
  action: string;
  requestId: string;
};

export async function runServerAction<T>(
  action: string,
  handler: (context: ServerActionContext) => Promise<T>,
): Promise<T> {
  const context = {
    action,
    requestId: randomUUID(),
  };

  logInfo("web.action.invoked", context);

  try {
    const result = await handler(context);

    logInfo("web.action.completed", context);

    return result;
  } catch (error) {
    logServerActionFailed(context, error);
    throw error;
  }
}

export function logServerActionFailed(
  context: ServerActionContext,
  error: unknown,
  extraContext: LogContext = {},
): void {
  const log = isExpectedServerActionFailure(error) ? logWarn : logError;

  log("web.action.failed", {
    ...context,
    ...extraContext,
    ...serializeErrorForLog(error),
  });
}

function isExpectedServerActionFailure(error: unknown): boolean {
  if (error instanceof WebAuthenticationError) {
    return true;
  }

  return error instanceof ApiResponseError && error.statusCode >= 400 && error.statusCode < 500;
}
