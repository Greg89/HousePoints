import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  assignUserHouseSchema,
  createHouseSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub, isAdminRole } from "../actor.js";
import { info, warn } from "../logging.js";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.post("/admin/context", async (request, reply) => {
    const parsed = actorScopeSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor || !isAdminRole(actor.role)) {
      warn(request.log, "admin.forbidden", {});
      return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
    }

    const [users, houses] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { displayName: "asc" },
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          houseId: true,
        },
      }),
      prisma.house.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, color: true, description: true },
      }),
    ]);

    info(request.log, "admin.context.loaded", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      users: users.length,
      houses: houses.length,
    });

    return {
      organizationId: actor.organizationId,
      organizationSlug: actor.organizationSlug,
      users,
      houses,
    };
  });

  app.post("/admin/houses", async (request, reply) => {
    const parsed = createHouseSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor || !isAdminRole(actor.role)) {
      warn(request.log, "admin.forbidden", {});
      return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
    }

    const house = await prisma.house.upsert({
      where: {
        organizationId_name: {
          organizationId: actor.organizationId,
          name: parsed.data.name,
        },
      },
      update: {
        color: parsed.data.color,
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
      create: {
        organizationId: actor.organizationId,
        name: parsed.data.name,
        color: parsed.data.color,
        description: parsed.data.description ?? null,
      },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
      },
    });

    info(request.log, "admin.house.created", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      houseId: house.id,
      houseName: house.name,
    });

    return reply.status(201).send(house);
  });

  app.post("/admin/users/assign-house", async (request, reply) => {
    const parsed = assignUserHouseSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor || !isAdminRole(actor.role)) {
      warn(request.log, "admin.forbidden", {});
      return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
    }

    const [targetUser, targetHouse] = await Promise.all([
      prisma.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: { id: true, organizationId: true },
      }),
      prisma.house.findUnique({
        where: { id: parsed.data.targetHouseId },
        select: { id: true, organizationId: true, name: true },
      }),
    ]);

    if (!targetUser || targetUser.organizationId !== actor.organizationId) {
      return reply.status(404).send({ message: "Target user not found", code: "TARGET_USER_NOT_FOUND" });
    }

    if (!targetHouse || targetHouse.organizationId !== actor.organizationId) {
      return reply.status(404).send({ message: "Target house not found", code: "TARGET_HOUSE_NOT_FOUND" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: { houseId: targetHouse.id },
      select: {
        id: true,
        displayName: true,
        houseId: true,
      },
    });

    info(request.log, "admin.user.house_assigned", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      targetUserId: updatedUser.id,
      targetHouseId: targetHouse.id,
      targetHouseName: targetHouse.name,
    });

    return updatedUser;
  });
}
