import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  createAuth0AccessTokenVerifierFromEnv,
  createOptionalAuth0IdTokenVerifierFromEnv,
  type VerifyAccessToken,
  type VerifyIdToken,
} from "./auth.js";
import {
  registerAuthenticationHook,
  registerRequestLifecycleHooks,
} from "./api-hooks.js";
import {
  readCorsAllowedOriginsFromEnv,
  readExpoAccessTokenFromEnv,
  readPointAdjustmentsEnabledFromEnv,
  readPushDispatchEnabledFromEnv,
} from "./config.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerOrgRoutes } from "./routes/orgs.js";
import { registerPointRoutes } from "./routes/points.js";
import { registerReleaseRoutes } from "./routes/releases.js";
import { registerSeasonRoutes } from "./routes/seasons.js";
import { registerUserRoutes } from "./routes/users.js";
import { createApiLogger } from "./logging.js";
import {
  applyMutationRateLimit,
  attachRateLimitLogContext,
  GLOBAL_RATE_LIMIT,
  logRateLimitExceeded,
  rateLimitKey,
} from "./rate-limits.js";
import { ExpoPushDispatcher, type PushDispatcher } from "./push-dispatcher.js";

type BuildAppOptions = {
  verifyAccessToken?: VerifyAccessToken;
  verifyIdToken?: VerifyIdToken | null;
  corsAllowedOrigins?: readonly string[];
  disableRateLimit?: boolean;
  pointAdjustmentsEnabled?: boolean;
  pushDispatcher?: PushDispatcher | null;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const apiLogger = createApiLogger();
  const verifyAccessToken =
    options.verifyAccessToken ?? createAuth0AccessTokenVerifierFromEnv();
  const verifyIdToken =
    options.verifyIdToken ?? createOptionalAuth0IdTokenVerifierFromEnv();
  const corsAllowedOrigins =
    options.corsAllowedOrigins ?? readCorsAllowedOriginsFromEnv();
  const pointAdjustmentsEnabled =
    options.pointAdjustmentsEnabled ?? readPointAdjustmentsEnabledFromEnv();
  const pushDispatcher = options.pushDispatcher === undefined
    ? readPushDispatchEnabledFromEnv()
      ? new ExpoPushDispatcher(readExpoAccessTokenFromEnv())
      : undefined
    : options.pushDispatcher ?? undefined;
  const app = Fastify({
    loggerInstance: apiLogger.logger,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
    disableRequestLogging: true,
  });

  app.addHook("onClose", async () => {
    await apiLogger.close();
  });

  await app.register(cors, {
    origin: [...corsAllowedOrigins],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "authorization",
      "content-type",
      "x-request-id",
      "x-auth0-id-token",
      "x-housepoints-release-secret",
    ],
    maxAge: 600,
  });

  registerAuthenticationHook(app, verifyAccessToken);

  if (!options.disableRateLimit) {
    app.addHook("onRoute", applyMutationRateLimit);
    app.addHook("preHandler", async (request) => {
      attachRateLimitLogContext(request);
    });

    await app.register(rateLimit, {
      global: true,
      hook: "preHandler",
      max: GLOBAL_RATE_LIMIT.max,
      timeWindow: GLOBAL_RATE_LIMIT.timeWindow,
      keyGenerator: rateLimitKey,
      onExceeded: logRateLimitExceeded,
      errorResponseBuilder: (_request, context) => ({
        statusCode: context.statusCode,
        code: "RATE_LIMITED",
        message: "Too many requests — please slow down.",
      }),
    });
  }

  registerRequestLifecycleHooks(app);

  await registerHealthRoutes(app);
  await registerSeasonRoutes(app, { pushDispatcher });
  await registerAdminRoutes(app, { pushDispatcher });
  await registerDeviceRoutes(app);
  await registerNotificationRoutes(app);
  await registerOrgRoutes(app, { pushDispatcher });
  await registerUserRoutes(app, { verifyIdToken });
  await registerPointRoutes(app, { pointAdjustmentsEnabled, pushDispatcher });
  await registerReleaseRoutes(app, { pushDispatcher });
  await registerDashboardRoutes(app);

  return app;
}


