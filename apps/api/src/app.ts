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
import { readCorsAllowedOriginsFromEnv, readPointAdjustmentsEnabledFromEnv } from "./config.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerOrgRoutes } from "./routes/orgs.js";
import { registerPointRoutes } from "./routes/points.js";
import { registerSeasonRoutes } from "./routes/seasons.js";
import { registerUserRoutes } from "./routes/users.js";
import { createApiLogger } from "./logging.js";

type BuildAppOptions = {
  verifyAccessToken?: VerifyAccessToken;
  verifyIdToken?: VerifyIdToken | null;
  corsAllowedOrigins?: readonly string[];
  disableRateLimit?: boolean;
  pointAdjustmentsEnabled?: boolean;
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
    allowedHeaders: ["authorization", "content-type", "x-request-id", "x-auth0-id-token"],
    maxAge: 600,
  });

  registerAuthenticationHook(app, verifyAccessToken);

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      global: true,
      max: 60,
      timeWindow: "1 minute",
      errorResponseBuilder: () => ({
        code: "RATE_LIMITED",
        message: "Too many requests â€” please slow down.",
      }),
    });
  }

  registerRequestLifecycleHooks(app);

  await registerHealthRoutes(app);
  await registerSeasonRoutes(app);
  await registerAdminRoutes(app);
  await registerNotificationRoutes(app);
  await registerOrgRoutes(app);
  await registerUserRoutes(app, { verifyIdToken });
  await registerPointRoutes(app, { pointAdjustmentsEnabled });
  await registerDashboardRoutes(app);

  return app;
}


