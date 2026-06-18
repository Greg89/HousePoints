import "server-only";

import { randomUUID } from "node:crypto";
import {
  logError,
  logInfo,
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
  logError("web.action.failed", {
    ...context,
    ...extraContext,
    ...serializeErrorForLog(error),
  });
}
