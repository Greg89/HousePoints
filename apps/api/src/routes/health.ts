import type { FastifyInstance } from "fastify";
import { info } from "../logging.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (request) => {
    info(request.log, "health.checked", {});
    return { ok: true };
  });
}
