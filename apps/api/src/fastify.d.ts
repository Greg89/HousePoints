import type { AuthPrincipal } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthPrincipal;
  }
}
