import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { reportClientErrorSchema } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { parseBody, requireActor } from "../route-helpers.js";

function fingerprint(input: { type: string; message: string; sourcePath: string | null }): string {
  return createHash("sha256").update(`${input.type}\n${input.message.toLowerCase()}\n${input.sourcePath ?? ""}`).digest("hex");
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/([?&](?:token|code|secret|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 500);
}

export async function registerTelemetryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/telemetry/client-error", async (request, reply) => {
    const parsed = await parseBody(reportClientErrorSchema, request, reply);
    if (!parsed) return;
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const now = new Date();
    const message = sanitizeMessage(parsed.message);
    const errorFingerprint = fingerprint({ ...parsed, message });
    await prisma.organizationErrorSignal.upsert({
      where: { organizationId_fingerprint: { organizationId: actor.organizationId, fingerprint: errorFingerprint } },
      create: { organizationId: actor.organizationId, fingerprint: errorFingerprint, errorType: parsed.type, message, sourcePath: parsed.sourcePath, firstSeenAt: now, lastSeenAt: now },
      update: { occurrenceCount: { increment: 1 }, lastSeenAt: now, message, sourcePath: parsed.sourcePath },
    });
    return reply.status(202).send({ recorded: true });
  });
}
