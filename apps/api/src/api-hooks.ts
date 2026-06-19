import type { FastifyInstance } from "fastify";
import {
  readBearerToken,
  type VerifyAccessToken,
} from "./auth.js";
import { error, info, warn } from "./logging.js";

export function isPublicRoute(routeUrl: string | undefined): boolean {
  return routeUrl === "/health";
}

export function registerAuthenticationHook(
  app: FastifyInstance,
  verifyAccessToken: VerifyAccessToken,
): void {
  app.decorateRequest("auth");

  app.addHook("preValidation", async (request, reply) => {
    if (isPublicRoute(request.routeOptions.url)) {
      return;
    }

    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      warn(request.log, "auth.token_missing", {});
      return reply.status(401).send({
        code: "AUTHENTICATION_REQUIRED",
        message: "A valid bearer token is required",
      });
    }

    try {
      request.auth = await verifyAccessToken(token);
    } catch (err) {
      warn(request.log, "auth.token_invalid", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return reply.status(401).send({
        code: "INVALID_ACCESS_TOKEN",
        message: "The access token is invalid or expired",
      });
    }
  });
}

export function registerRequestLifecycleHooks(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    request.log = request.log.child({
      requestId: request.id,
      route: request.url,
      method: request.method,
    });

    info(request.log, "request.received", {
      query: request.query,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    info(request.log, "request.completed", {
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime,
    });
  });

  app.setErrorHandler(async (err, request, reply) => {
    error(request.log, "request.unhandled_error", { statusCode: 500 }, err);
    await reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  });
}
