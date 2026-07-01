import type { FastifyInstance } from "fastify";
import {
  actorScopeSchema,
  bootstrapUserSchema,
  updateProfileSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { mapAppUser } from "../app-user.js";
import { info, warn } from "../logging.js";
import type { VerifyIdToken } from "../auth.js";
import { parseBody, requireActor } from "../route-helpers.js";

const userSelect = {
  id: true,
  auth0Sub: true,
  email: true,
  displayName: true,
  houseThemeEnabled: true,
  role: true,
  organizationId: true,
  organization: { select: { slug: true } },
  houseId: true,
  house: { select: { name: true, color: true } },
} as const;

function readVerifiedEmailClaim(claims: Record<string, unknown>): string | null {
  return typeof claims.email === "string" && claims.email_verified === true
    ? claims.email
    : null;
}

function readIdTokenHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  return value?.trim() || null;
}

async function readVerifiedEmailFromIdToken(input: {
  accessTokenSubject: string;
  idToken: string | null;
  verifyIdToken?: VerifyIdToken | null;
  log: Parameters<typeof warn>[0];
}): Promise<string | null> {
  if (!input.idToken) {
    return null;
  }

  if (!input.verifyIdToken) {
    return null;
  }

  try {
    const principal = await input.verifyIdToken(input.idToken);

    if (principal.subject !== input.accessTokenSubject) {
      warn(input.log, "users.bootstrap.id_token_subject_mismatch", {
        accessTokenSubject: input.accessTokenSubject,
        idTokenSubject: principal.subject,
      });
      return null;
    }

    const verifiedEmail = readVerifiedEmailClaim(principal.claims);

    if (!verifiedEmail) {
      warn(input.log, "users.bootstrap.id_token_email_unverified", {
        auth0Sub: input.accessTokenSubject,
        hasEmail: typeof principal.claims.email === "string",
        emailVerified: principal.claims.email_verified,
      });
    }

    return verifiedEmail;
  } catch (err) {
    warn(input.log, "users.bootstrap.id_token_invalid", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function findExistingUser(auth0Sub: string) {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: { user: { select: userSelect } },
  });
  return identity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: userSelect,
  });
}

export async function findUserByVerifiedEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: userSelect,
  });
}

export async function linkIdentityToUser(auth0Sub: string, userId: string) {
  return prisma.authIdentity.create({
    data: { providerSubject: auth0Sub, userId },
  });
}

export async function checkEmailConflict(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
}

export async function createBootstrappedUser(params: {
  auth0Sub: string;
  email: string | null;
  displayName: string;
}) {
  return prisma.user.create({
    data: {
      auth0Sub: params.auth0Sub,
      email: params.email,
      displayName: params.displayName,
      authIdentities: { create: { providerSubject: params.auth0Sub } },
    },
    select: userSelect,
  });
}

export async function updateUserProfile(
  actorId: string,
  update: { displayName?: string; houseThemeEnabled?: boolean },
) {
  return prisma.user.update({
    where: { id: actorId },
    data: {
      ...(update.displayName !== undefined ? { displayName: update.displayName } : {}),
      ...(update.houseThemeEnabled !== undefined ? { houseThemeEnabled: update.houseThemeEnabled } : {}),
    },
    select: { id: true, displayName: true, houseThemeEnabled: true },
  });
}

export async function listOrgMembers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      role: true,
      houseId: true,
      house: { select: { name: true, color: true } },
    },
  });
}

export async function registerUserRoutes(
  app: FastifyInstance,
  options: { verifyIdToken?: VerifyIdToken | null } = {},
): Promise<void> {
  app.post("/users/bootstrap", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request, reply) => {
    const parsed = await parseBody(bootstrapUserSchema, request, reply);
    if (!parsed) return;

    const auth0Sub = request.auth.subject;
    const existing = await findExistingUser(auth0Sub);

    if (existing) {
      info(request.log, "users.bootstrap.loaded", {
        userId: existing.id,
        auth0Sub: existing.auth0Sub,
        organizationId: existing.organizationId,
        hasHouse: Boolean(existing.houseId),
      });
      return { ...mapAppUser(existing), created: false };
    }

    const idToken = readIdTokenHeader(request.headers["x-auth0-id-token"]);
    const verifiedEmail =
      readVerifiedEmailClaim(request.auth.claims) ??
      await readVerifiedEmailFromIdToken({
        accessTokenSubject: auth0Sub,
        idToken,
        verifyIdToken: options.verifyIdToken,
        log: request.log,
      });
    const emailForStorage = verifiedEmail ?? parsed.email ?? null;
    const existingByEmail = verifiedEmail
      ? await findUserByVerifiedEmail(verifiedEmail)
      : null;

    if (existingByEmail) {
      await linkIdentityToUser(auth0Sub, existingByEmail.id);

      info(request.log, "users.bootstrap.identity_linked", {
        userId: existingByEmail.id,
        auth0Sub,
        email: existingByEmail.email,
        organizationId: existingByEmail.organizationId,
      });

      return { ...mapAppUser(existingByEmail), created: false };
    }

    const conflictingEmailUser = !verifiedEmail && parsed.email
      ? await checkEmailConflict(parsed.email)
      : null;

    if (conflictingEmailUser) {
      if (!idToken) {
        warn(request.log, "users.bootstrap.id_token_missing", {
          auth0Sub,
        });
      } else if (!options.verifyIdToken) {
        warn(request.log, "users.bootstrap.id_token_verifier_missing", {
          auth0Sub,
        });
      }

      warn(request.log, "users.bootstrap.account_link_required", {
        auth0Sub,
        email: parsed.email,
      });
      return reply.status(409).send({
        code: "ACCOUNT_LINK_REQUIRED",
        message: "This email is already registered with another login method. Sign in with the original provider or link the accounts in Auth0.",
      });
    }

    const createdUser = await createBootstrappedUser({
      auth0Sub,
      email: emailForStorage,
      displayName: parsed.displayName,
    });

    info(request.log, "users.bootstrap.created", {
      userId: createdUser.id,
      auth0Sub: createdUser.auth0Sub,
      hasOrg: false,
    });

    return reply.status(201).send({ ...mapAppUser(createdUser), created: true });
  });

  app.post("/users/profile", async (request, reply) => {
    const parsed = await parseBody(updateProfileSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const updated = await updateUserProfile(actor.id, {
      displayName: parsed.displayName,
      houseThemeEnabled: parsed.houseThemeEnabled,
    });

    info(request.log, "users.profile.updated", {
      actorUserId: actor.id,
      displayName: updated.displayName,
      houseThemeEnabled: updated.houseThemeEnabled,
    });

    return updated;
  });

  app.post("/members", async (request, reply) => {
    const parsed = await parseBody(actorScopeSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const members = await listOrgMembers(actor.organizationId);

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
