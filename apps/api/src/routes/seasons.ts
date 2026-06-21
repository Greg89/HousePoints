import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  createSeasonSchema,
  renameSeasonSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub, isAdminRole } from "../actor.js";
import { info, warn } from "../logging.js";
import { mapSeason, SeasonScopeError } from "../season-scope.js";

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export async function registerSeasonRoutes(app: FastifyInstance): Promise<void> {
  app.post("/seasons/context", async (request, reply) => {
    const parsed = actorScopeSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor) {
      warn(request.log, "points.actor_not_found", {});
      return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
    }

    const seasons = await prisma.season.findMany({
      where: {
        organizationId: actor.organizationId,
      },
      orderBy: {
        startsAt: "desc",
      },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        isActive: true,
      },
    });
    const activeSeason = seasons.find((season) => season.isActive);

    if (!activeSeason) {
      warn(request.log, "seasons.active_missing", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
      });
      return reply.status(409).send({
        message: "An active season is required",
        code: "ACTIVE_SEASON_REQUIRED",
      });
    }

    info(request.log, "seasons.context.loaded", {
      organizationId: actor.organizationId,
      seasons: seasons.length,
      activeSeasonId: activeSeason.id,
    });

    return {
      activeSeason: mapSeason(activeSeason),
      seasons: seasons.map(mapSeason),
    };
  });

  app.post("/seasons/start", async (request, reply) => {
    const parsed = createSeasonSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor || !isAdminRole(actor.role)) {
      warn(request.log, "seasons.start.forbidden", {});
      return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
    }

    try {
      const transition = await prisma.$transaction(async (tx) => {
        const currentSeason = await tx.season.findFirst({
          where: {
            organizationId: actor.organizationId,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
          },
        });

        if (!currentSeason) {
          throw new SeasonScopeError(409, "ACTIVE_SEASON_REQUIRED", "An active season is required");
        }

        const now = new Date();
        const previousSeason = await tx.season.update({
          where: { id: currentSeason.id },
          data: {
            isActive: false,
            endsAt: now,
          },
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
          },
        });
        const activeSeason = await tx.season.create({
          data: {
            organizationId: actor.organizationId,
            name: parsed.data.name,
            startsAt: now,
            isActive: true,
            createdById: actor.id,
          },
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true,
            isActive: true,
          },
        });

        await tx.auditEvent.create({
          data: {
            organizationId: actor.organizationId,
            actorUserId: actor.id,
            eventType: "SEASON_STARTED",
            summary: `${actor.displayName} started ${activeSeason.name}.`,
            metadata: {
              seasonId: activeSeason.id,
              seasonName: activeSeason.name,
              previousSeasonId: previousSeason.id,
              previousSeasonName: previousSeason.name,
            },
          },
        });

        return {
          previousSeason,
          activeSeason,
        };
      });

      info(request.log, "seasons.started", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        previousSeasonId: transition.previousSeason.id,
        activeSeasonId: transition.activeSeason.id,
      });

      return {
        previousSeason: mapSeason(transition.previousSeason),
        activeSeason: mapSeason(transition.activeSeason),
      };
    } catch (err) {
      if (err instanceof SeasonScopeError) {
        warn(request.log, "seasons.active_missing", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
        });
        return reply.status(err.statusCode).send({ message: err.message, code: err.code });
      }

      if (isUniqueConstraintError(err)) {
        warn(request.log, "seasons.name_conflict", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          seasonName: parsed.data.name,
        });
        return reply.status(409).send({
          message: "A season with that name already exists",
          code: "SEASON_NAME_TAKEN",
        });
      }

      throw err;
    }
  });

  app.post("/seasons/rename", async (request, reply) => {
    const parsed = renameSeasonSchema.safeParse(request.body);

    if (!parsed.success) {
      warn(request.log, "request.validation_failed", {
        issues: parsed.error.issues,
      });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);

    if (!actor || !isAdminRole(actor.role)) {
      warn(request.log, "seasons.rename.forbidden", {});
      return reply.status(403).send({ message: "Admin access required", code: "ADMIN_REQUIRED" });
    }

    const season = await prisma.season.findFirst({
      where: {
        id: parsed.data.seasonId,
        organizationId: actor.organizationId,
      },
      select: { id: true },
    });

    if (!season) {
      warn(request.log, "seasons.not_found", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId: parsed.data.seasonId,
      });
      return reply.status(404).send({ message: "Season not found", code: "SEASON_NOT_FOUND" });
    }

    try {
      const updatedSeason = await prisma.season.update({
        where: { id: season.id },
        data: { name: parsed.data.name },
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
          isActive: true,
        },
      });

      info(request.log, "seasons.renamed", {
        actorUserId: actor.id,
        organizationId: actor.organizationId,
        seasonId: updatedSeason.id,
      });

      return mapSeason(updatedSeason);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        warn(request.log, "seasons.name_conflict", {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          seasonId: parsed.data.seasonId,
          seasonName: parsed.data.name,
        });
        return reply.status(409).send({
          message: "A season with that name already exists",
          code: "SEASON_NAME_TAKEN",
        });
      }

      throw err;
    }
  });
}
