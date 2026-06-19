import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  bootstrapUserSchema,
  updateProfileSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub } from "../actor.js";
import { mapAppUser } from "../app-user.js";
import { info, warn } from "../logging.js";

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.post("/users/bootstrap", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = bootstrapUserSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "users.bootstrap.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const userSelect = {
      id: true,
      auth0Sub: true,
      email: true,
      displayName: true,
      role: true,
      organizationId: true,
      organization: { select: { slug: true } },
      houseId: true,
      house: { select: { name: true, color: true } },
    } as const;

    const existing = await prisma.user.findUnique({
      where: { auth0Sub: request.auth.subject },
      select: userSelect,
    });

    if (existing) {
      info(request.log, "users.bootstrap.loaded", {
        userId: existing.id,
        auth0Sub: existing.auth0Sub,
        organizationId: existing.organizationId,
        hasHouse: Boolean(existing.houseId),
      });
      return { ...mapAppUser(existing), created: false };
    }

    // New user has no org yet. They must create or join one next.
    const createdUser = await prisma.user.create({
      data: {
        auth0Sub: request.auth.subject,
        email: parsed.data.email ?? null,
        displayName: parsed.data.displayName,
      },
      select: userSelect,
    });

    info(request.log, "users.bootstrap.created", {
      userId: createdUser.id,
      auth0Sub: createdUser.auth0Sub,
      hasOrg: false,
    });

    return reply.status(201).send({ ...mapAppUser(createdUser), created: true });
  });

  app.post("/users/profile", async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "users.profile.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "points.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: { displayName: parsed.data.displayName },
      select: { id: true, displayName: true },
    });

    info(request.log, "users.profile.updated", {
      actorUserId: actor.id,
      displayName: updated.displayName,
    });

    return updated;
  });

  app.post("/members", async (request, reply) => {
    const parsed = actorScopeSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "points.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const members = await prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        role: true,
        houseId: true,
        house: { select: { name: true, color: true } },
      },
    });

    return members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      role: m.role,
      houseId: m.houseId,
      houseName: m.house?.name ?? null,
      houseColor: m.house?.color ?? null,
    }));
  });
}
