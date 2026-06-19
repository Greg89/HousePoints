import "server-only";

import {
  redactLogContext,
  type LogContext,
} from "@housepoints/contracts";
import pino from "pino";
import { createStream, type PinoSeqStream } from "pino-seq";

export {
  redactLogContext,
  serializeErrorForLog,
} from "@housepoints/contracts";
export type { LogContext } from "@housepoints/contracts";

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
  | "web.seasons.renamed"
  | "web.seasons.started"
  | "points.adjust.requested"
  | "points.adjust.completed"
  | "web.profile.updated"
  | "web.profile.update_failed";

type WebLogger = {
  logger: pino.Logger;
  seqEnabled: boolean;
};

function getEnvironment(): string {
  return (
    process.env.RAILWAY_ENVIRONMENT_NAME ??
    process.env.NODE_ENV ??
    "development"
  );
}

function createWebLogger(): WebLogger {
  const service = process.env.SERVICE_NAME ?? "housepoints-web";
  const environment = getEnvironment();
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
      onError: (error) => {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            service,
            environment,
            event: "seq.delivery_failed",
            error: error instanceof Error ? error.message : String(error),
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
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    pino.multistream(streams),
  );

  return {
    logger,
    seqEnabled: Boolean(seqStream),
  };
}

const webLogger = createWebLogger();

function write(level: WebLogLevel, event: WebLogEvent, context: LogContext = {}): void {
  webLogger.logger[level](
    redactLogContext({
      event,
      ...context,
      seqEnabled: webLogger.seqEnabled,
    }),
    event,
  );
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
