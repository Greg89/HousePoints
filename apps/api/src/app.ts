import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  createAuth0AccessTokenVerifierFromEnv,
  type VerifyAccessToken,
} from "./auth.js";
import {
  registerAuthenticationHook,
  registerRequestLifecycleHooks,
} from "./api-hooks.js";
import { readCorsAllowedOriginsFromEnv } from "./config.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerOrgRoutes } from "./routes/orgs.js";
import { registerPointRoutes } from "./routes/points.js";
import { registerSeasonRoutes } from "./routes/seasons.js";
import { registerUserRoutes } from "./routes/users.js";
import { createApiLogger } from "./logging.js";

type BuildAppOptions = {
  verifyAccessToken?: VerifyAccessToken;
  corsAllowedOrigins?: readonly string[];
};

export async function buildApp(options: BuildAppOptions = {}) {
  const apiLogger = createApiLogger();
  const verifyAccessToken =
    options.verifyAccessToken ?? createAuth0AccessTokenVerifierFromEnv();
  const corsAllowedOrigins =
    options.corsAllowedOrigins ?? readCorsAllowedOriginsFromEnv();
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
    allowedHeaders: ["authorization", "content-type", "x-request-id"],
    maxAge: 600,
  });

  registerAuthenticationHook(app, verifyAccessToken);

  await app.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      code: "RATE_LIMITED",
      message: "Too many requests â€” please slow down.",
    }),
  });

  registerRequestLifecycleHooks(app);

  await registerHealthRoutes(app);
  await registerSeasonRoutes(app);
  await registerAdminRoutes(app);
  await registerOrgRoutes(app);
  await registerUserRoutes(app);
  await registerPointRoutes(app);
  await registerDashboardRoutes(app);

  return app;
}


