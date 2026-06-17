import type { FastifyBaseLogger } from "fastify";
import { finished } from "node:stream/promises";
import pino from "pino";
import { createStream, type PinoSeqStream } from "pino-seq";

export type ApiLogEvent =
  | "api.starting"
  | "api.listening"
  | "api.stopping"
  | "api.shutdown_failed"
  | "auth.token_missing"
  | "auth.token_invalid"
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
  | "dashboard.summary.loaded"
  | "points.actor_not_found"
  | "points.actor_house_unassigned"
  | "points.target_user_unassigned"
  | "points.cross_organization_target"
  | "points.adjusted"
  | "users.profile.updated"
  | "users.profile.validation_failed"
  | "orgs.created"
  | "orgs.create.slug_taken"
  | "orgs.create.already_in_org"
  | "orgs.invite.created"
  | "orgs.join.invalid_token"
  | "orgs.join.token_already_used"
  | "orgs.join.token_expired"
  | "orgs.join.already_in_org"
  | "orgs.join.success";

type LogContext = Record<string, unknown>;

type ApiLogger = {
  logger: FastifyBaseLogger;
  seqEnabled: boolean;
  close: () => Promise<void>;
};

export function createApiLogger(): ApiLogger {
  const service = process.env.SERVICE_NAME ?? "housepoints-api";
  const environment =
    process.env.RAILWAY_ENVIRONMENT_NAME ??
    process.env.NODE_ENV ??
    "development";
  const seqServerUrl = process.env.SEQ_SERVER_URL?.trim().replace(/\/+$/, "");
  let seqStream: PinoSeqStream | undefined;

  const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

  if (seqServerUrl) {
    seqStream = createStream({
      serverUrl: seqServerUrl,
      apiKey: process.env.SEQ_API_KEY?.trim() || undefined,
      maxBatchingTime: 2_000,
      additionalProperties: {
        service,
        environment,
      },
      onError: (err) => {
        console.error(
          JSON.stringify({
            level: "error",
            service,
            environment,
            event: "seq.delivery_failed",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      },
    });
    streams.push({ stream: seqStream });
  }

  const logger = pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      base: {
        service,
        environment,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
        replicaId: process.env.RAILWAY_REPLICA_ID,
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "headers.authorization",
          "headers.cookie",
        ],
        censor: "[REDACTED]",
      },
    },
    pino.multistream(streams),
  );

  return {
    logger,
    seqEnabled: Boolean(seqStream),
    close: async () => {
      if (seqStream && !seqStream.destroyed) {
        seqStream.end();
        await finished(seqStream);
      }
    },
  };
}

export function info(logger: FastifyBaseLogger, event: ApiLogEvent, context: LogContext = {}): void {
  logger.info({ event, ...context }, event);
}

export function warn(logger: FastifyBaseLogger, event: ApiLogEvent, context: LogContext = {}): void {
  logger.warn({ event, ...context }, event);
}

export function error(
  logger: FastifyBaseLogger,
  event: ApiLogEvent,
  context: LogContext = {},
  err?: unknown,
): void {
  if (err) {
    logger.error({ event, ...context, err }, event);
    return;
  }

  logger.error({ event, ...context }, event);
}
