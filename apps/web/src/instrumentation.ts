import type { Instrumentation } from "next";
import { logError, serializeErrorForLog } from "@/lib/logging";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  logError("web.request.failed", {
    ...serializeErrorForLog(error),
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  });
};
