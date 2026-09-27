import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import {
  RECOGNITION_CATEGORY_API_VERSION,
  archiveRecognitionCategorySchema,
  createRecognitionCategorySchema,
  listRecognitionCategoriesSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { parseBody, requireActor, requireOwnerActor } from "../route-helpers.js";
import { scoringWriteTime, ScoringWriteError, withScoringWrite } from "../scoring-write.js";

type RecognitionCategoryRouteOptions = {
  mutationsEnabled: boolean;
};

function mapCategory(category: {
  id: string;
  name: string;
  description: string | null;
  legacyTrait: string | null;
  createdAt: Date;
  archivedAt: Date | null;
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    legacyTrait: category.legacyTrait,
    createdAt: category.createdAt.toISOString(),
    archivedAt: category.archivedAt?.toISOString() ?? null,
  };
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeDescription(description: string | null | undefined) {
  const value = description?.trim();
  return value ? value : null;
}

export async function listRecognitionCategories(params: {
  organizationId: string;
  includeArchived: boolean;
}) {
  return prisma.recognitionCategory.findMany({
    where: {
      organizationId: params.organizationId,
      ...(params.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

export async function createRecognitionCategory(params: {
  organizationId: string;
  actorId: string;
  actorDisplayName: string;
  idempotencyKey: string;
  name: string;
  description?: string | null;
}) {
  return withScoringWrite(params.organizationId, async (tx) => {
    const name = normalizeName(params.name);
    const description = normalizeDescription(params.description);
    const prior = await tx.recognitionCategory.findUnique({
      where: {
        organizationId_creationKey: {
          organizationId: params.organizationId,
          creationKey: params.idempotencyKey,
        },
      },
    });
    if (prior) {
      if (prior.name !== name || prior.description !== description) {
        throw new ScoringWriteError(409, "IDEMPOTENCY_KEY_CONFLICT", "This category creation key was already used for different details.");
      }
      return prior;
    }

    const now = await scoringWriteTime(tx);
    try {
      const category = await tx.recognitionCategory.create({
        data: {
          organizationId: params.organizationId,
          creationKey: params.idempotencyKey,
          name,
          description,
          createdAt: now,
          createdById: params.actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: params.organizationId,
          actorUserId: params.actorId,
          eventType: "RECOGNITION_CATEGORY_CREATED",
          summary: `${params.actorDisplayName} created the ${category.name} recognition category.`,
          metadata: {
            categoryId: category.id,
            name: category.name,
            description: category.description,
          },
        },
      });
      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ScoringWriteError(409, "RECOGNITION_CATEGORY_NAME_IN_USE", "An active recognition category already uses that name.");
      }
      throw error;
    }
  });
}

export async function archiveRecognitionCategory(params: {
  organizationId: string;
  actorId: string;
  actorDisplayName: string;
  categoryId: string;
}) {
  return withScoringWrite(params.organizationId, async (tx) => {
    const category = await tx.recognitionCategory.findFirst({
      where: { id: params.categoryId, organizationId: params.organizationId },
    });
    if (!category) {
      throw new ScoringWriteError(404, "RECOGNITION_CATEGORY_NOT_FOUND", "Recognition category not found.");
    }
    if (category.archivedAt) return category;

    const activeCount = await tx.recognitionCategory.count({
      where: { organizationId: params.organizationId, archivedAt: null },
    });
    if (activeCount <= 1) {
      throw new ScoringWriteError(409, "RECOGNITION_CATEGORY_LAST_ACTIVE", "Add another category before archiving this one.");
    }

    const archivedAt = await scoringWriteTime(tx);
    const archived = await tx.recognitionCategory.update({
      where: { id: category.id },
      data: { archivedAt, archivedById: params.actorId },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorId,
        eventType: "RECOGNITION_CATEGORY_ARCHIVED",
        summary: `${params.actorDisplayName} archived the ${category.name} recognition category.`,
        metadata: {
          categoryId: category.id,
          name: category.name,
          archivedAt: archivedAt.toISOString(),
        },
      },
    });
    return archived;
  });
}

export async function registerRecognitionCategoryRoutes(
  app: FastifyInstance,
  options: RecognitionCategoryRouteOptions,
): Promise<void> {
  app.post("/recognition-categories/list", async (request, reply) => {
    const parsed = await parseBody(listRecognitionCategoriesSchema, request, reply);
    if (!parsed) return;
    const actor = await requireActor(request, reply);
    if (!actor) return;
    const categories = await listRecognitionCategories({
      organizationId: actor.organizationId,
      includeArchived: parsed.includeArchived,
    });
    return reply.send({
      apiVersion: RECOGNITION_CATEGORY_API_VERSION,
      categories: categories.map(mapCategory),
    });
  });

  app.post("/recognition-categories/create", async (request, reply) => {
    if (!options.mutationsEnabled) {
      return reply.status(404).send({
        code: "RECOGNITION_CATEGORY_MUTATIONS_DISABLED",
        message: "Recognition category management is not enabled.",
      });
    }
    const parsed = await parseBody(createRecognitionCategorySchema, request, reply);
    if (!parsed) return;
    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;
    const category = await createRecognitionCategory({
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorDisplayName: actor.displayName,
      idempotencyKey: parsed.idempotencyKey,
      name: parsed.name,
      description: parsed.description,
    });
    return reply.status(201).send({
      apiVersion: RECOGNITION_CATEGORY_API_VERSION,
      category: mapCategory(category),
    });
  });

  app.post("/recognition-categories/archive", async (request, reply) => {
    if (!options.mutationsEnabled) {
      return reply.status(404).send({
        code: "RECOGNITION_CATEGORY_MUTATIONS_DISABLED",
        message: "Recognition category management is not enabled.",
      });
    }
    const parsed = await parseBody(archiveRecognitionCategorySchema, request, reply);
    if (!parsed) return;
    const actor = await requireOwnerActor(request, reply);
    if (!actor) return;
    const category = await archiveRecognitionCategory({
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorDisplayName: actor.displayName,
      categoryId: parsed.categoryId,
    });
    return reply.send({
      apiVersion: RECOGNITION_CATEGORY_API_VERSION,
      category: mapCategory(category),
    });
  });
}