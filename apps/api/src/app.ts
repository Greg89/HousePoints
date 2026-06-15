import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import {
  actorScopeSchema,
  adjustPointsSchema,
  assignUserHouseSchema,
  bootstrapUserSchema,
  createHouseSchema,
  createInviteSchema,
  createOrgSchema,
  joinOrgSchema,
  promoteUserSchema,
  updateProfileSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import {
  createAuth0AccessTokenVerifierFromEnv,
  readBearerToken,
  type VerifyAccessToken,
} from "./auth.js";
import { createApiLogger, error, info, warn } from "./logging.js";

type ActorRecord = {
  id: string;
  auth0Sub: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  houseId: string | null;
  organizationId: string;
  organizationSlug: string;
};

import { createHash, randomBytes } from "node:crypto";

function generateInviteToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex string
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** OWNER inherits all ADMIN privileges */
function isAdmin(role: "MEMBER" | "ADMIN" | "OWNER"): boolean {
  return role === "ADMIN" || role === "OWNER";
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

  // Users without an org can't act on any org-scoped endpoint
  if (!actor.organizationId || !actor.organization) {
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
  role: "MEMBER" | "ADMIN" | "OWNER";
  houseId: string | null;
  organizationId: string | null;
  organization: { slug: string } | null;
  house: { name: string; color: string } | null;
}) {
  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization?.slug ?? null,
    houseId: user.houseId,
    houseName: user.house?.name ?? null,
    houseColor: user.house?.color ?? null,
  };
}

type BuildAppOptions = {
  verifyAccessToken?: VerifyAccessToken;
};

export async function buildApp(options: BuildAppOptions = {}) {
  const apiLogger = createApiLogger();
  const verifyAccessToken =
    options.verifyAccessToken ?? createAuth0AccessTokenVerifierFromEnv();
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
    origin: true,
  });

  app.decorateRequest("auth");

  app.addHook("preValidation", async (request, reply) => {
    if (request.routeOptions.url === "/health") {
      return;
    }

    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      warn(request.log, "auth.token_missing", {});
      return reply.status(401).send({
        code: "AUTHENTICATION_REQUIRED",
        message: "A valid bearer token is required",
      });
    }

    try {
      request.auth = await verifyAccessToken(token);
    } catch (err) {
      warn(request.log, "auth.token_invalid", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return reply.status(401).send({
        code: "INVALID_ACCESS_TOKEN",
        message: "The access token is invalid or expired",
      });
    }

  });

await app.register(rateLimit, {
  global: true,
  max: 60,
  timeWindow: "1 minute",
  errorResponseBuilder: () => ({
    code: "RATE_LIMITED",
    message: "Too many requests â€” please slow down.",
  }),
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
  await reply.status(500).send({ code: "INTERNAL_ERROR", message: "Internal server error" });
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
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {});
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

  // New user â€” no org yet. Create the User row without an org.
  // They must then create an org (POST /orgs/create) or join one (POST /orgs/join).
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

app.post("/admin/context", async (request, reply) => {
  const parsed = actorScopeSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor || !isAdmin(actor.role)) {
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

  if (!actor || !isAdmin(actor.role)) {
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

  if (!actor || !isAdmin(actor.role)) {
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

app.post("/points/adjust", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
  const parsed = adjustPointsSchema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "points.actor_not_found", {
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
      trait: parsed.data.trait,
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

// POST /users/scores - per-member point totals (sum of delta grouped by targetUserId)
app.post("/users/scores", async (request, reply) => {
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

  const grouped = await prisma.pointTransaction.groupBy({
    by: ["targetUserId"],
    where: {
      organizationId: actor.organizationId,
      targetUserId: { not: null },
    },
    _sum: { delta: true },
    orderBy: { _sum: { delta: "desc" } },
  });

  return grouped.map((row) => ({
    memberId: row.targetUserId as string,
    points: row._sum.delta ?? 0,
  }));
});

// POST /members - returns org members for the award dialog (any authenticated member)
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

// POST /transactions/recent - enriched activity feed
app.post("/transactions/recent", async (request, reply) => {
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

  const transactions = await prisma.pointTransaction.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      delta: true,
      reason: true,
      trait: true,
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
    trait: tx.trait ?? null,
    createdAt: tx.createdAt.toISOString(),
  }));
});

// ── Org management ───────────────────────────────────────────────────────────

// POST /orgs/create — first-time org setup; caller becomes OWNER
app.post("/orgs/create", async (request, reply) => {
  const parsed = createOrgSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const { email, displayName, orgName, orgSlug } = parsed.data;
  const auth0Sub = request.auth.subject;

  // Reject if slug is already taken
  const slugTaken = await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } });
  if (slugTaken) {
    warn(request.log, "orgs.create.slug_taken", { orgSlug });
    return reply.status(409).send({ code: "SLUG_TAKEN", message: `The slug "${orgSlug}" is already in use. Choose a different one.` });
  }

  // Reject if this Auth0 user is already in an org
  const existingUser = await prisma.user.findUnique({
    where: { auth0Sub },
    select: { id: true, organizationId: true },
  });
  if (existingUser?.organizationId) {
    warn(request.log, "orgs.create.already_in_org", { auth0Sub, existingOrgId: existingUser.organizationId });
    return reply.status(409).send({ code: "ALREADY_IN_ORG", message: "You are already a member of an organisation." });
  }

  const org = await prisma.organization.create({
    data: { name: orgName, slug: orgSlug },
    select: { id: true, slug: true, name: true },
  });

  // Create or update the user row as OWNER
  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { organizationId: org.id, role: "OWNER", displayName, email: email ?? null },
        select: { id: true, auth0Sub: true, email: true, displayName: true, role: true, organizationId: true, organization: { select: { slug: true } }, houseId: true, house: { select: { name: true, color: true } } },
      })
    : await prisma.user.create({
        data: { auth0Sub, email: email ?? null, displayName, organizationId: org.id, role: "OWNER" },
        select: { id: true, auth0Sub: true, email: true, displayName: true, role: true, organizationId: true, organization: { select: { slug: true } }, houseId: true, house: { select: { name: true, color: true } } },
      });

  info(request.log, "orgs.created", { orgId: org.id, orgSlug: org.slug, ownerId: user.id });
  return reply.status(201).send({ ...mapAppUser(user), created: true });
});

// POST /orgs/invite — admin/owner generates a single-use invite link
app.post("/orgs/invite", async (request, reply) => {
  const parsed = createInviteSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const actor = await getActorBySub(request.auth.subject);
  if (!actor || !isAdmin(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    return reply.status(403).send({ code: "ADMIN_REQUIRED", message: "Admin access required" });
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);

  const invite = await prisma.orgInvite.create({
    data: {
      organizationId: actor.organizationId,
      tokenHash,
      createdById: actor.id,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });

  info(request.log, "orgs.invite.created", { inviteId: invite.id, actorId: actor.id, orgId: actor.organizationId, expiresAt });

  return reply.status(201).send({
    id: invite.id,
    // Return the raw token ONCE — it is never stored in the DB
    token: rawToken,
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: null,
  });
});

// POST /orgs/join — consume an invite token and add the user to the org
app.post("/orgs/join", async (request, reply) => {
  const parsed = joinOrgSchema.safeParse(request.body);
  if (!parsed.success) {
    warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
    return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
  }

  const { email, displayName, inviteToken } = parsed.data;
  const auth0Sub = request.auth.subject;
  const tokenHash = hashToken(inviteToken);

  const invite = await prisma.orgInvite.findUnique({
    where: { tokenHash },
    select: { id: true, organizationId: true, expiresAt: true, usedAt: true },
  });

  if (!invite) {
    warn(request.log, "orgs.join.invalid_token", { auth0Sub });
    return reply.status(404).send({ code: "INVITE_NOT_FOUND", message: "Invite link is invalid or has already been used." });
  }

  if (invite.usedAt) {
    warn(request.log, "orgs.join.token_already_used", { auth0Sub, inviteId: invite.id });
    return reply.status(409).send({ code: "INVITE_USED", message: "This invite link has already been used." });
  }

  if (invite.expiresAt < new Date()) {
    warn(request.log, "orgs.join.token_expired", { auth0Sub, inviteId: invite.id });
    return reply.status(410).send({ code: "INVITE_EXPIRED", message: "This invite link has expired. Ask an admin to generate a new one." });
  }

  // Block users already in a different org
  const existingUser = await prisma.user.findUnique({
    where: { auth0Sub },
    select: { id: true, organizationId: true },
  });
  if (existingUser?.organizationId && existingUser.organizationId !== invite.organizationId) {
    warn(request.log, "orgs.join.already_in_org", { auth0Sub, existingOrgId: existingUser.organizationId });
    return reply.status(409).send({ code: "ALREADY_IN_ORG", message: "You are already a member of an organisation." });
  }
  // If already in the same org, still mark invite used and return current mapping
  if (existingUser?.organizationId === invite.organizationId) {
    await prisma.orgInvite.update({ where: { id: invite.id }, data: { usedAt: new Date(), usedById: existingUser.id } });
  }

  const userSelect = {
    id: true, auth0Sub: true, email: true, displayName: true, role: true,
    organizationId: true, organization: { select: { slug: true } },
    houseId: true, house: { select: { name: true, color: true } },
  } as const;

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: { organizationId: invite.organizationId, displayName, email: email ?? undefined },
        select: userSelect,
      })
    : await prisma.user.create({
        data: { auth0Sub, email: email ?? null, displayName, organizationId: invite.organizationId },
        select: userSelect,
      });

  // Mark invite as used (idempotent — already done above if org matched)
  await prisma.orgInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), usedById: user.id },
  });

  info(request.log, "orgs.join.success", { userId: user.id, orgId: invite.organizationId, inviteId: invite.id });
  return reply.status(200).send({ ...mapAppUser(user), created: !existingUser });
});

  return app;
}


