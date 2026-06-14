import type { FastifyBaseLogger } from "fastify";

export type ApiLogEvent =
  | "api.starting"
  | "api.listening"
  | "request.received"
  | "request.completed"
  | "request.validation_failed"
  | "request.unhandled_error"
  | "health.checked"
  | "users.bootstrap.validation_failed"
  | "users.bootstrap.created"
  | "users.bootstrap.loaded"
  | "admin.forbidden"
  | "admin.context.loaded"
  | "admin.house.created"
  | "admin.user.house_assigned"
  | "leaderboard.fetched"
  | "points.actor_not_found"
  | "points.actor_house_unassigned"
  | "points.target_user_unassigned"
  | "points.cross_organization_target"
  | "points.adjusted"
  | "users.profile.updated"
  | "users.profile.validation_failed";

type LogContext = Record<string, unknown>;

export function info(logger: FastifyBaseLogger, event: ApiLogEvent, context: LogContext = {}): void {
  logger.info({ event, ...context });
}

export function warn(logger: FastifyBaseLogger, event: ApiLogEvent, context: LogContext = {}): void {
  logger.warn({ event, ...context });
}

export function error(
  logger: FastifyBaseLogger,
  event: ApiLogEvent,
  context: LogContext = {},
  err?: unknown,
): void {
  if (err) {
    logger.error({ event, ...context, err });
    return;
  }

  logger.error({ event, ...context });
}
