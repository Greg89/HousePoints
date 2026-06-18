import type { Instrumentation } from "next";

function serializeInstrumentationError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorType: typeof error,
      errorMessage: String(error),
    };
  }

  const errorWithDigest = error as Error & { digest?: unknown };

  return {
    errorName: error.name,
    errorMessage: error.message,
    digest:
      typeof errorWithDigest.digest === "string"
        ? errorWithDigest.digest
        : undefined,
  };
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const payload = {
    ...serializeInstrumentationError(error),
    method: request.method,
    path: request.path,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  };

  if (process.env.NEXT_RUNTIME === "edge") {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: process.env.SERVICE_NAME ?? "housepoints-web",
        environment:
          process.env.RAILWAY_ENVIRONMENT_NAME ??
          process.env.NODE_ENV ??
          "development",
        event: "web.request.failed",
        ...payload,
      }),
    );
    return;
  }

  const { logError } = await import("@/lib/logging");

  logError("web.request.failed", payload);
};
