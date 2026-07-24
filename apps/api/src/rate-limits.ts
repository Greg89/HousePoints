import { createHmac, randomBytes } from "node:crypto";
import type { FastifyRequest, RouteOptions } from "fastify";
import { warn } from "./logging.js";

export const GLOBAL_RATE_LIMIT = {
  max: 300,
  timeWindow: "1 minute",
} as const;

const MUTATION_RATE_LIMITS = new Map<string, number>([
  ["/admin/houses", 20],
  ["/admin/org/archive", 5],
  ["/admin/org/owner", 5],
  ["/admin/org/settings", 20],
  ["/admin/org/slug", 10],
  ["/admin/users/assign-house", 30],
  ["/admin/users/display-name", 30],
  ["/admin/users/remove", 20],
  ["/admin/users/role", 20],
  ["/notifications/mark-all-read", 60],
  ["/notifications/mark-read", 60],
  ["/orgs/create", 5],
  ["/orgs/invite", 20],
  ["/orgs/join", 10],
  ["/points/adjust", 20],
  ["/points/deduct", 10],
  ["/points/delete", 20],
  ["/seasons/rename", 20],
  ["/seasons/start", 5],
  ["/system/releases/broadcast", 10],
  ["/system/releases/record", 10],
  ["/transactions/react", 60],
  ["/users/bootstrap", 30],
  ["/users/profile", 30],
]);

const rateLimitLogSalt = randomBytes(32);

export function rateLimitKey(request: FastifyRequest): string {
  return request.auth?.subject
    ? `user:${request.auth.subject}`
    : `ip:${request.ip}`;
}

export function applyMutationRateLimit(routeOptions: RouteOptions): void {
  const max = MUTATION_RATE_LIMITS.get(routeOptions.url);
  if (!max) {
    return;
  }

  routeOptions.config ??= {};
  routeOptions.config.rateLimit = {
    max,
    timeWindow: GLOBAL_RATE_LIMIT.timeWindow,
  };
}

function hashRateLimitKey(key: string): string {
  return createHmac("sha256", rateLimitLogSalt).update(key).digest("hex").slice(0, 16);
}

function rateLimitLogContext(request: FastifyRequest, key: string) {
  return {
    rateLimitKeyType: key.startsWith("user:") ? "user" : "ip",
    rateLimitKeyHash: hashRateLimitKey(key),
  };
}

export function attachRateLimitLogContext(request: FastifyRequest): void {
  const key = rateLimitKey(request);
  request.log = request.log.child(rateLimitLogContext(request, key));
}

export function logRateLimitExceeded(request: FastifyRequest, key: string): void {
  const routeLimit = request.routeOptions.config.rateLimit;
  const max = typeof routeLimit === "object" && typeof routeLimit.max === "number"
    ? routeLimit.max
    : GLOBAL_RATE_LIMIT.max;

  warn(request.log, "request.rate_limited", {
    statusCode: 429,
    rateLimitMax: max,
    rateLimitWindow: GLOBAL_RATE_LIMIT.timeWindow,
    ...rateLimitLogContext(request, key),
  });
}
