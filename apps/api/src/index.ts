import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  actorScopeSchema,
  adjustPointsSchema,
  assignUserHouseSchema,
  bootstrapUserSchema,
  createHouseSchema,
  updateProfileSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { error, info, warn } from "./logging.js";

const serviceName = process.env.SERVICE_NAME ?? "housepoints-api";
const logLevel = process.env.LOG_LEVEL ?? "info";
const defaultOrganizationSlug = process.env.DEFAULT_ORGANIZATION_SLUG ?? "default";
const defaultOrganizationName = process.env.DEFAULT_ORGANIZATION_NAME ?? "Default Org";
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);

type ActorRecord = {
  id: string;
  auth0Sub: string;
  role: "MEMBER" | "ADMIN";
  houseId: string | null;
  organizationId: string;
  organizationSlug: string;
};

async function getOrCreateOrganization(slug?: string) {
  const organizationSlug = slug ?? defaultOrganizationSlug;

  return prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {},
    create: {
      slug: organizationSlug,
      name: organizationSlug === defaultOrganizationSlug ? defaultOrganizationName : organizationSlug,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });
}

async function getActorBySub(auth0Sub: string): Promise<ActorRecord | null> {
  const actor = await prisma.user.findUnique({
    where: { auth0Sub },
    select: {
      id: true,
      auth0Sub: true,
      role: true,
      houseId: true,
      organizationId: true,
      organization: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!actor) {
    return null;
  }

  return {
    id: actor.id,
    auth0Sub: actor.auth0Sub,
    role: actor.role,
    houseId: actor.houseId,
    organizationId: actor.organizationId,
    organizationSlug: actor.organization.slug,
  };
}

function mapAppUser(user: {
  id: string;
  auth0Sub: string;
  email: string | null;
  displayName: string;
  role: "MEMBER" | "ADMIN";
  houseId: string | null;
  organizationId: string;
  organization: { slug: string };
  house: { name: string; color: string } | null;
}) {
  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
    houseId: user.houseId,
    houseName: user.house?.name ?? null,
    houseColor: user.house?.color ?? null,
  };
}

const app = Fastify({
  logger: {
    level: logLevel,
    base: {
      service: serviceName,
      env: process.env.NODE_ENV ?? "development",
    },
  },
  requestIdHeader: "x-request-id",
  genReqId: () => randomUUID(),
  disableRequestLogging: true,
});

info(app.log, "api.starting", { port });

await app.register(cors, {
  origin: true,
});

app.addHook("onRequest", async (request) => {
  request.log = request.log.child({
    requestId: request.id,
    route: request.url,
    method: request.method,
  });

  info(request.log, "request.received", {
    query: request.query,
  });
});

app.addHook("onResponse", async (request, reply) => {
  info(request.log, "request.completed", {
    statusCode: reply.statusCode,
    durationMs: reply.elapsedTime,
  });
});

app.setErrorHandler(async (err, request, reply) => {
  error(request.log, "request.unhandled_error", { statusCode: 500 }, err);
  await reply.status(500).send({ message: "Internal server error" });
});

app.get("/health", async (request) => {
  info(request.log, "health.checked", {});
  return { ok: true };
});

app.post("/houses/leaderboard", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
    });
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  const houses = await prisma.house.findMany({
    where: {
      organizationId: actor.organizationId,
    },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      _count: {
        select: {
          transactions: true,
          users: true,
        },
      },
      transactions: {
        select: {
          delta: true,
        },
      },
    },
  });

  const leaderboard = houses
    .map((house) => ({
      id: house.id,
      name: house.name,
      color: house.color,
      description: house.description,
      score: house.transactions.reduce((total, tx) => total + tx.delta, 0),
      transactions: house._count.transactions,
      memberCount: house._count.users,
    }))
    .sort((a, b) => b.score - a.score);

  info(request.log, "leaderboard.fetched", {
    organizationId: actor.organizationId,
    houses: leaderboard.length,
  });

  return leaderboard;
});

app.post("/users/bootstrap", async (request, reply) => {
  const parsed = bootstrapUserSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "users.bootstrap.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const existing = await prisma.user.findUnique({
    where: {
      auth0Sub: parsed.data.auth0Sub,
    },
    select: {
      id: true,
      auth0Sub: true,
      email: true,
      displayName: true,
      role: true,
      organizationId: true,
      organization: {
        select: {
          slug: true,
        },
      },
      houseId: true,
      house: {
        select: {
          name: true,
          color: true,
        },
      },
    },
  });

  if (existing) {
    info(request.log, "users.bootstrap.loaded", {
      userId: existing.id,
      auth0Sub: existing.auth0Sub,
      organizationId: existing.organizationId,
      organizationSlug: existing.organization.slug,
      hasHouse: Boolean(existing.houseId),
    });

    return {
      ...mapAppUser(existing),
      created: false,
    };
  }

  const organization = await getOrCreateOrganization(parsed.data.organizationSlug);

  const createdUser = await prisma.user.create({
    data: {
      auth0Sub: parsed.data.auth0Sub,
      email: parsed.data.email ?? null,
      displayName: parsed.data.displayName,
      organizationId: organization.id,
    },
    select: {
      id: true,
      auth0Sub: true,
      email: true,
      displayName: true,
      role: true,
      organizationId: true,
      organization: {
        select: {
          slug: true,
        },
      },
      houseId: true,
      house: {
        select: {
          name: true,
          color: true,
        },
      },
    },
  });

  info(request.log, "users.bootstrap.created", {
    userId: createdUser.id,
    auth0Sub: createdUser.auth0Sub,
    organizationId: createdUser.organizationId,
    organizationSlug: createdUser.organization.slug,
    hasHouse: Boolean(createdUser.houseId),
  });

  return reply.status(201).send({
    ...mapAppUser(createdUser),
    created: true,
  });
});

app.post("/admin/context", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor || actor.role !== "ADMIN") {
    warn(request.log, "admin.forbidden", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
    });
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
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor || actor.role !== "ADMIN") {
    warn(request.log, "admin.forbidden", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
    });
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
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor || actor.role !== "ADMIN") {
    warn(request.log, "admin.forbidden", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
    });
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

app.post("/points/adjust", async (request, reply) => {
  const parsed = adjustPointsSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
      targetUserId: parsed.data.targetUserId,
      delta: parsed.data.delta,
    });
    return reply.status(403).send({
      message: "Signed-in user is not mapped to an internal account",
      code: "ACTOR_NOT_MAPPED",
    });
  }

  if (!actor.houseId) {
    warn(request.log, "points.actor_house_unassigned", {
      actorUserId: actor.id,
      actorAuth0Sub: actor.auth0Sub,
      targetUserId: parsed.data.targetUserId,
      delta: parsed.data.delta,
    });
    return reply.status(403).send({
      message: "Signed-in user must be assigned to a house before awarding points",
      code: "ACTOR_HOUSE_UNASSIGNED",
    });
  }

  // Resolve the target user and derive their house
  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.targetUserId },
    select: { id: true, organizationId: true, houseId: true, displayName: true },
  });

  if (!targetUser || targetUser.organizationId !== actor.organizationId) {
    warn(request.log, "points.cross_organization_target", {
      actorUserId: actor.id,
      actorAuth0Sub: actor.auth0Sub,
      actorOrganizationId: actor.organizationId,
      targetUserId: parsed.data.targetUserId,
    });
    return reply.status(403).send({
      message: "Target user is outside your organization",
      code: "CROSS_ORGANIZATION_TARGET",
    });
  }

  if (!targetUser.houseId) {
    warn(request.log, "points.target_user_unassigned", {
      actorUserId: actor.id,
      targetUserId: targetUser.id,
    });
    return reply.status(422).send({
      message: "Target user is not assigned to a house",
      code: "TARGET_USER_UNASSIGNED",
    });
  }

  const transaction = await prisma.pointTransaction.create({
    data: {
      organizationId: actor.organizationId,
      actorUserId: actor.id,
      targetUserId: targetUser.id,
      targetHouseId: targetUser.houseId,
      delta: parsed.data.delta,
      reason: parsed.data.reason,
    },
  });

  info(request.log, "points.adjusted", {
    transactionId: transaction.id,
    actorUserId: actor.id,
    actorAuth0Sub: actor.auth0Sub,
    organizationId: actor.organizationId,
    targetUserId: targetUser.id,
    targetHouseId: targetUser.houseId,
    delta: transaction.delta,
  });

  return reply.status(201).send(transaction);
});

// POST /users/profile - update the authenticated user's display name
app.post("/users/profile", async (request, reply) => {
  const parsed = updateProfileSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "users.profile.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {
      actorAuth0Sub: parsed.data.actorAuth0Sub,
    });
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

// POST /members - returns org members for the award dialog (any authenticated member)
app.post("/members", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor) {
    warn(request.log, "points.actor_not_found", { actorAuth0Sub: parsed.data.actorAuth0Sub });
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

// POST /transactions/recent - enriched activity feed
app.post("/transactions/recent", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(parsed.data.actorAuth0Sub);

  if (!actor) {
    warn(request.log, "points.actor_not_found", { actorAuth0Sub: parsed.data.actorAuth0Sub });
    return reply.status(403).send({ message: "Actor is not mapped", code: "ACTOR_NOT_MAPPED" });
  }

  const transactions = await prisma.pointTransaction.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      delta: true,
      reason: true,
      createdAt: true,
      actor: { select: { displayName: true } },
      targetUser: { select: { displayName: true } },
      targetHouse: { select: { name: true, color: true } },
    },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    actorName: tx.actor.displayName,
    targetUserName: tx.targetUser?.displayName ?? "Unknown",
    targetHouseName: tx.targetHouse.name,
    targetHouseColor: tx.targetHouse.color,
    delta: tx.delta,
    reason: tx.reason,
    createdAt: tx.createdAt.toISOString(),
  }));
});

await app.listen({ port, host: "0.0.0.0" });
info(app.log, "api.listening", { port });
