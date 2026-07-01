import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createInviteSchema,
  joinInvitePreviewSchema,
  createOrgSchema,
  joinOrgSchema,
  orgRouteContextRequestSchema,
} from "@housepoints/contracts";
import {
  createPrimaryOrganizationSlugAlias,
  isOrganizationSlugReserved,
  prisma,
  resolveOrganizationSlug,
} from "@housepoints/db";
import { getUserOrgContextBySub } from "../actor.js";
import { mapAppUser } from "../app-user.js";
import { info, warn, type ApiLogEvent } from "../logging.js";
import { parseBody, requireAdminActor } from "../route-helpers.js";
import { buildMemberNeedsAssignmentNotificationData } from "../notifications.js";

function generateInviteToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex string
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

type InviteJoinErrorCode =
  | "INVITE_NOT_FOUND"
  | "INVITE_USED"
  | "INVITE_EXPIRED"
  | "INVITE_ORG_MISMATCH"
  | "ALREADY_IN_ORG"
  | "ACCOUNT_LINK_REQUIRED";

class InviteJoinError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: InviteJoinErrorCode,
    message: string,
    readonly inviteId?: string,
  ) {
    super(message);
    this.name = "InviteJoinError";
  }
}

export async function checkOrgCreatePreconditions(auth0Sub: string, email?: string | null) {
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: { user: { select: { id: true, organizationId: true } } },
  });
  const existingUser = existingIdentity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: { id: true, organizationId: true },
  });
  const conflictingEmailUser = !existingUser && email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : null;
  return { existingUser: existingUser ?? null, conflictingEmailUser };
}

export async function createOrgInDb(params: {
  auth0Sub: string;
  email?: string | null;
  displayName: string;
  orgName: string;
  orgSlug: string;
  firstHouseName: string;
  firstHouseColor: string;
  existingUser: { id: string; organizationId: string | null } | null;
}) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: params.orgName, slug: params.orgSlug },
      select: { id: true, slug: true, name: true },
    });

    await createPrimaryOrganizationSlugAlias(tx, { organizationId: org.id, slug: org.slug });

    const house = await tx.house.create({
      data: { organizationId: org.id, name: params.firstHouseName, color: params.firstHouseColor },
      select: { id: true, name: true, color: true },
    });

    const userSelect = {
      id: true, auth0Sub: true, email: true, displayName: true, houseThemeEnabled: true, role: true,
      organizationId: true, organization: { select: { slug: true } },
      houseId: true, house: { select: { name: true, color: true } },
    } as const;

    const user = params.existingUser
      ? await tx.user.update({
          where: { id: params.existingUser.id },
          data: {
            organizationId: org.id,
            houseId: house.id,
            role: "OWNER",
            displayName: params.displayName,
            email: params.email ?? null,
            authIdentities: {
              connectOrCreate: {
                where: { providerSubject: params.auth0Sub },
                create: { providerSubject: params.auth0Sub },
              },
            },
          },
          select: userSelect,
        })
      : await tx.user.create({
          data: {
            auth0Sub: params.auth0Sub,
            email: params.email ?? null,
            displayName: params.displayName,
            organizationId: org.id,
            houseId: house.id,
            role: "OWNER",
            authIdentities: { create: { providerSubject: params.auth0Sub } },
          },
          select: userSelect,
        });

    const season = await tx.season.create({
      data: {
        organizationId: org.id,
        name: "Season 0",
        startsAt: new Date(),
        isActive: true,
        createdById: user.id,
      },
      select: { id: true },
    });

    return { org, house, user, season };
  });
}

export async function createOrgInviteInDb(params: {
  organizationId: string;
  actorId: string;
  actorDisplayName: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.orgInvite.create({
      data: {
        organizationId: params.organizationId,
        tokenHash: params.tokenHash,
        createdById: params.actorId,
        expiresAt: params.expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    await tx.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorId,
        eventType: "INVITE_CREATED",
        summary: `${params.actorDisplayName} created an invite link.`,
        metadata: { inviteId: invite.id, expiresAt: invite.expiresAt.toISOString() },
      },
    });
    return invite;
  });
}

export async function loadJoinPreviewInDb(params: {
  auth0Sub: string;
  tokenHash: string;
  organizationSlug: string;
  checkedAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.orgInvite.findUnique({
      where: { tokenHash: params.tokenHash },
      select: {
        id: true, organizationId: true, expiresAt: true, usedAt: true,
        organization: { select: { name: true } },
      },
    });
    const resolvedSlug = await resolveOrganizationSlug(tx, params.organizationSlug);

    if (!invite) {
      throw new InviteJoinError(404, "INVITE_NOT_FOUND", "Invite link is invalid or has already been used.");
    }
    if (invite.usedAt) {
      throw new InviteJoinError(409, "INVITE_USED", "This invite link has already been used.", invite.id);
    }
    if (invite.expiresAt <= params.checkedAt) {
      throw new InviteJoinError(410, "INVITE_EXPIRED", "This invite link has expired. Ask an admin to generate a new one.", invite.id);
    }
    if (!resolvedSlug || resolvedSlug.organizationId !== invite.organizationId) {
      throw new InviteJoinError(404, "INVITE_ORG_MISMATCH", "This invite link is not valid for this organisation.", invite.id);
    }

    const existingIdentity = await tx.authIdentity.findUnique({
      where: { providerSubject: params.auth0Sub },
      select: {
        user: { select: { organizationId: true, organization: { select: { name: true, slug: true } } } },
      },
    });
    const existingUser = existingIdentity?.user ?? await tx.user.findUnique({
      where: { auth0Sub: params.auth0Sub },
      select: { organizationId: true, organization: { select: { name: true, slug: true } } },
    });
    const membershipStatus = !existingUser?.organizationId
      ? "NONE"
      : existingUser.organizationId === invite.organizationId
        ? "SAME_ORG"
        : "OTHER_ORG";

    return {
      organizationName: resolvedSlug.organization.name,
      organizationSlug: resolvedSlug.currentSlug,
      membershipStatus,
      memberOrganizationName: existingUser?.organization?.name ?? null,
      memberOrganizationSlug: existingUser?.organization?.slug ?? null,
      inviteId: invite.id,
    };
  });
}

export async function joinOrgInDb(params: {
  auth0Sub: string;
  email?: string | null;
  displayName: string;
  tokenHash: string;
  organizationSlug?: string | null;
  claimedAt: Date;
}) {
  const userSelect = {
    id: true, auth0Sub: true, email: true, displayName: true, houseThemeEnabled: true, role: true,
    organizationId: true, organization: { select: { slug: true } },
    houseId: true, house: { select: { name: true, color: true } },
  } as const;

  return prisma.$transaction(async (tx) => {
    const invite = await tx.orgInvite.findUnique({
      where: { tokenHash: params.tokenHash },
      select: {
        id: true, organizationId: true, expiresAt: true, usedAt: true,
        organization: { select: { name: true } },
      },
    });

    if (!invite) {
      throw new InviteJoinError(404, "INVITE_NOT_FOUND", "Invite link is invalid or has already been used.");
    }
    if (invite.usedAt) {
      throw new InviteJoinError(409, "INVITE_USED", "This invite link has already been used.", invite.id);
    }
    if (invite.expiresAt <= params.claimedAt) {
      throw new InviteJoinError(410, "INVITE_EXPIRED", "This invite link has expired. Ask an admin to generate a new one.", invite.id);
    }

    if (params.organizationSlug) {
      const resolvedSlug = await resolveOrganizationSlug(tx, params.organizationSlug);
      if (!resolvedSlug || resolvedSlug.organizationId !== invite.organizationId) {
        throw new InviteJoinError(404, "INVITE_ORG_MISMATCH", "This invite link is not valid for this organisation.", invite.id);
      }
    }

    const existingIdentity = await tx.authIdentity.findUnique({
      where: { providerSubject: params.auth0Sub },
      select: { user: { select: { id: true, organizationId: true } } },
    });
    const existingUser = existingIdentity?.user ?? await tx.user.findUnique({
      where: { auth0Sub: params.auth0Sub },
      select: { id: true, organizationId: true },
    });

    if (existingUser?.organizationId && existingUser.organizationId !== invite.organizationId) {
      throw new InviteJoinError(409, "ALREADY_IN_ORG", "You are already a member of an organisation.", invite.id);
    }

    const conflictingEmailUser = !existingUser && params.email
      ? await tx.user.findUnique({ where: { email: params.email }, select: { id: true } })
      : null;
    if (conflictingEmailUser) {
      throw new InviteJoinError(409, "ACCOUNT_LINK_REQUIRED", "This email is already registered with another login method. Sign in with the original provider or link the accounts in Auth0.", invite.id);
    }

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            organizationId: invite.organizationId,
            displayName: params.displayName,
            email: params.email ?? undefined,
            authIdentities: {
              connectOrCreate: {
                where: { providerSubject: params.auth0Sub },
                create: { providerSubject: params.auth0Sub },
              },
            },
          },
          select: userSelect,
        })
      : await tx.user.create({
          data: {
            auth0Sub: params.auth0Sub,
            email: params.email ?? null,
            displayName: params.displayName,
            organizationId: invite.organizationId,
            authIdentities: { create: { providerSubject: params.auth0Sub } },
          },
          select: userSelect,
        });

    const claim = await tx.orgInvite.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: params.claimedAt } },
      data: { usedAt: params.claimedAt, usedById: user.id },
    });
    if (claim.count !== 1) {
      throw new InviteJoinError(409, "INVITE_USED", "This invite link has already been used.", invite.id);
    }

    await tx.auditEvent.create({
      data: {
        organizationId: invite.organizationId,
        actorUserId: user.id,
        eventType: "INVITE_USED",
        summary: `${user.displayName} joined with an invite link.`,
        metadata: { inviteId: invite.id, usedById: user.id, usedByName: user.displayName },
      },
    });

    let notificationCount = 0;
    if (!user.houseId) {
      const notificationRecipients = await tx.user.findMany({
        where: {
          organizationId: invite.organizationId,
          role: { in: ["ADMIN", "OWNER"] },
          id: { not: user.id },
        },
        select: { id: true },
      });
      if (notificationRecipients.length > 0) {
        const created = await tx.notification.createMany({
          data: notificationRecipients.map((recipient) => buildMemberNeedsAssignmentNotificationData({
            organizationId: invite.organizationId,
            recipientId: recipient.id,
            joinedUserName: user.displayName,
            organizationName: invite.organization?.name ?? "the organization",
            joinedUserId: user.id,
          })),
          skipDuplicates: true,
        });
        notificationCount = created.count;
      }
    }

    return {
      user,
      created: !existingUser,
      inviteId: invite.id,
      organizationId: invite.organizationId,
      notificationCount,
    };
  });
}

export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.post("/orgs/route-context", async (request, reply) => {
    const parsed = await parseBody(orgRouteContextRequestSchema, request, reply);
    if (!parsed) return;

    const requestedSlug = parsed.slug;
    const [resolvedSlug, actorOrg] = await Promise.all([
      resolveOrganizationSlug(prisma, requestedSlug),
      getUserOrgContextBySub(request.auth.subject),
    ]);

    if (!resolvedSlug) {
      info(request.log, "orgs.route_context.not_found", {
        requestedSlug,
        actorOrganizationId: actorOrg?.organizationId ?? null,
      });
      return reply.status(200).send({
        status: "NOT_FOUND",
        requestedSlug,
      });
    }

    if (!actorOrg?.organizationId || !actorOrg.organizationSlug || !actorOrg.organizationName) {
      info(request.log, "orgs.route_context.no_actor_org", {
        requestedSlug,
        organizationId: resolvedSlug.organizationId,
      });
      return reply.status(200).send({
        status: "NO_ACTOR_ORG",
        requestedSlug,
        organizationSlug: resolvedSlug.currentSlug,
      });
    }

    if (actorOrg.organizationId !== resolvedSlug.organizationId) {
      info(request.log, "orgs.route_context.different_org", {
        requestedSlug,
        organizationId: resolvedSlug.organizationId,
        actorOrganizationId: actorOrg.organizationId,
      });
      return reply.status(200).send({
        status: "DIFFERENT_ORG",
        requestedSlug,
        organizationSlug: resolvedSlug.currentSlug,
        actorOrganizationSlug: actorOrg.organizationSlug,
        actorOrganizationName: actorOrg.organizationName,
      });
    }

    if (resolvedSlug.currentSlug !== requestedSlug) {
      info(request.log, "orgs.route_context.alias_redirect", {
        requestedSlug,
        organizationId: resolvedSlug.organizationId,
        organizationSlug: resolvedSlug.currentSlug,
      });
      return reply.status(200).send({
        status: "ALIAS_REDIRECT",
        requestedSlug,
        organizationSlug: resolvedSlug.currentSlug,
      });
    }

    info(request.log, "orgs.route_context.match", {
      requestedSlug,
      organizationId: resolvedSlug.organizationId,
    });
    return reply.status(200).send({
      status: "MATCH",
      requestedSlug,
      organizationSlug: resolvedSlug.currentSlug,
    });
  });

  app.post("/orgs/create", async (request, reply) => {
    const parsed = await parseBody(createOrgSchema, request, reply);
    if (!parsed) return;

    const {
      email,
      displayName,
      orgName,
      orgSlug,
      firstHouseName,
      firstHouseColor,
    } = parsed;
    const auth0Sub = request.auth.subject;

    // Reject if slug is already taken or reserved by an alias.
    const slugTaken = await isOrganizationSlugReserved(prisma, orgSlug);
    if (slugTaken) {
      warn(request.log, "orgs.create.slug_taken", { orgSlug });
      return reply.status(409).send({ code: "SLUG_TAKEN", message: `The slug "${orgSlug}" is already in use. Choose a different one.` });
    }

    const { existingUser, conflictingEmailUser } = await checkOrgCreatePreconditions(auth0Sub, email);
    if (existingUser?.organizationId) {
      warn(request.log, "orgs.create.already_in_org", { auth0Sub, existingOrgId: existingUser.organizationId });
      return reply.status(409).send({ code: "ALREADY_IN_ORG", message: "You are already a member of an organisation." });
    }

    if (conflictingEmailUser) {
      warn(request.log, "orgs.create.account_link_required", { auth0Sub, email });
      return reply.status(409).send({
        code: "ACCOUNT_LINK_REQUIRED",
        message: "This email is already registered with another login method. Sign in with the original provider or link the accounts in Auth0.",
      });
    }

    const { org, house, user, season } = await createOrgInDb({
      auth0Sub,
      email,
      displayName,
      orgName,
      orgSlug,
      firstHouseName,
      firstHouseColor,
      existingUser,
    });

    info(request.log, "orgs.created", {
      orgId: org.id,
      orgSlug: org.slug,
      houseId: house.id,
      ownerId: user.id,
      activeSeasonId: season.id,
    });
    return reply.status(201).send({ ...mapAppUser(user), created: true });
  });

  app.post("/orgs/invite", async (request, reply) => {
    const parsed = await parseBody(createInviteSchema, request, reply);
    if (!parsed) return;

    const actor = await requireAdminActor(request, reply);
    if (!actor) return;

    const rawToken = generateInviteToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + parsed.expiresInHours * 60 * 60 * 1000);

    const invite = await createOrgInviteInDb({
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorDisplayName: actor.displayName,
      tokenHash,
      expiresAt,
    });

    info(request.log, "orgs.invite.created", { inviteId: invite.id, actorId: actor.id, orgId: actor.organizationId, expiresAt });

    return reply.status(201).send({
      id: invite.id,
      // Return the raw token once; it is never stored in the DB.
      token: rawToken,
      joinPath: `/o/${actor.organizationSlug}/join/${rawToken}`,
      expiresAt: invite.expiresAt.toISOString(),
      usedAt: null,
    });
  });

  app.post("/orgs/join/preview", async (request, reply) => {
    const parsed = await parseBody(joinInvitePreviewSchema, request, reply);
    if (!parsed) return;

    const { inviteToken, organizationSlug } = parsed;
    const tokenHash = hashToken(inviteToken);
    const checkedAt = new Date();

    try {
      const preview = await loadJoinPreviewInDb({
        auth0Sub: request.auth.subject,
        tokenHash,
        organizationSlug,
        checkedAt,
      });

      info(request.log, "orgs.join.preview_loaded", {
        orgSlug: preview.organizationSlug,
        inviteId: preview.inviteId,
      });

      return reply.status(200).send({
        organizationName: preview.organizationName,
        organizationSlug: preview.organizationSlug,
        membershipStatus: preview.membershipStatus,
        memberOrganizationName: preview.memberOrganizationName,
        memberOrganizationSlug: preview.memberOrganizationSlug,
      });
    } catch (err) {
      if (!(err instanceof InviteJoinError)) {
        throw err;
      }

      warn(request.log, getInviteJoinFailureEvent(err.code), {
        auth0Sub: request.auth.subject,
        inviteId: err.inviteId,
        organizationSlug,
      });

      return reply.status(err.statusCode).send({
        code: err.code,
        message: err.message,
      });
    }
  });

  app.post("/orgs/join", async (request, reply) => {
    const parsed = await parseBody(joinOrgSchema, request, reply);
    if (!parsed) return;

    const { email, displayName, inviteToken, organizationSlug } = parsed;
    const auth0Sub = request.auth.subject;
    const tokenHash = hashToken(inviteToken);

    const claimedAt = new Date();

    try {
      const result = await joinOrgInDb({
        auth0Sub,
        email,
        displayName,
        tokenHash,
        organizationSlug,
        claimedAt,
      });

      info(request.log, "orgs.join.success", {
        userId: result.user.id,
        orgId: result.organizationId,
        inviteId: result.inviteId,
        notificationCount: result.notificationCount,
      });
      return reply.status(200).send({
        ...mapAppUser(result.user),
        created: result.created,
      });
    } catch (err) {
      if (!(err instanceof InviteJoinError)) {
        throw err;
      }

      warn(request.log, getInviteJoinFailureEvent(err.code), {
        auth0Sub,
        inviteId: err.inviteId,
        organizationSlug,
      });
      return reply.status(err.statusCode).send({
        code: err.code,
        message: err.message,
      });
    }
  });
}

function getInviteJoinFailureEvent(code: InviteJoinErrorCode): ApiLogEvent {
  return code === "INVITE_NOT_FOUND"
    ? "orgs.join.invalid_token"
    : code === "INVITE_EXPIRED"
      ? "orgs.join.token_expired"
      : code === "INVITE_USED"
        ? "orgs.join.token_already_used"
        : code === "INVITE_ORG_MISMATCH"
          ? "orgs.join.organization_mismatch"
          : code === "ACCOUNT_LINK_REQUIRED"
            ? "orgs.join.account_link_required"
            : "orgs.join.already_in_org";
}
