import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createInviteSchema,
  createOrgSchema,
  joinOrgSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { getActorBySub, isAdminRole } from "../actor.js";
import { mapAppUser } from "../app-user.js";
import { info, warn } from "../logging.js";

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
  | "ALREADY_IN_ORG";

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

export async function registerOrgRoutes(app: FastifyInstance): Promise<void> {
  app.post("/orgs/create", async (request, reply) => {
    const parsed = createOrgSchema.safeParse(request.body);
    if (!parsed.success) {
      warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const {
      email,
      displayName,
      orgName,
      orgSlug,
      firstHouseName,
      firstHouseColor,
    } = parsed.data;
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

    const { org, house, user } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, slug: orgSlug },
        select: { id: true, slug: true, name: true },
      });

      const house = await tx.house.create({
        data: {
          organizationId: org.id,
          name: firstHouseName,
          color: firstHouseColor,
        },
        select: { id: true, name: true, color: true },
      });

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

      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              organizationId: org.id,
              houseId: house.id,
              role: "OWNER",
              displayName,
              email: email ?? null,
            },
            select: userSelect,
          })
        : await tx.user.create({
            data: {
              auth0Sub,
              email: email ?? null,
              displayName,
              organizationId: org.id,
              houseId: house.id,
              role: "OWNER",
            },
            select: userSelect,
          });

      return { org, house, user };
    });

    info(request.log, "orgs.created", {
      orgId: org.id,
      orgSlug: org.slug,
      houseId: house.id,
      ownerId: user.id,
    });
    return reply.status(201).send({ ...mapAppUser(user), created: true });
  });

  app.post("/orgs/invite", async (request, reply) => {
    const parsed = createInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const actor = await getActorBySub(request.auth.subject);
    if (!actor || !isAdminRole(actor.role)) {
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
      // Return the raw token once; it is never stored in the DB.
      token: rawToken,
      expiresAt: invite.expiresAt.toISOString(),
      usedAt: null,
    });
  });

  app.post("/orgs/join", async (request, reply) => {
    const parsed = joinOrgSchema.safeParse(request.body);
    if (!parsed.success) {
      warn(request.log, "request.validation_failed", { issues: parsed.error.issues });
      return reply.status(400).send({ code: "VALIDATION_ERROR", message: "Validation failed", errors: parsed.error.flatten() });
    }

    const { email, displayName, inviteToken } = parsed.data;
    const auth0Sub = request.auth.subject;
    const tokenHash = hashToken(inviteToken);

    const userSelect = {
      id: true, auth0Sub: true, email: true, displayName: true, role: true,
      organizationId: true, organization: { select: { slug: true } },
      houseId: true, house: { select: { name: true, color: true } },
    } as const;
    const claimedAt = new Date();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const invite = await tx.orgInvite.findUnique({
          where: { tokenHash },
          select: { id: true, organizationId: true, expiresAt: true, usedAt: true },
        });

        if (!invite) {
          throw new InviteJoinError(
            404,
            "INVITE_NOT_FOUND",
            "Invite link is invalid or has already been used.",
          );
        }

        if (invite.usedAt) {
          throw new InviteJoinError(
            409,
            "INVITE_USED",
            "This invite link has already been used.",
            invite.id,
          );
        }

        if (invite.expiresAt <= claimedAt) {
          throw new InviteJoinError(
            410,
            "INVITE_EXPIRED",
            "This invite link has expired. Ask an admin to generate a new one.",
            invite.id,
          );
        }

        const existingUser = await tx.user.findUnique({
          where: { auth0Sub },
          select: { id: true, organizationId: true },
        });

        if (
          existingUser?.organizationId &&
          existingUser.organizationId !== invite.organizationId
        ) {
          throw new InviteJoinError(
            409,
            "ALREADY_IN_ORG",
            "You are already a member of an organisation.",
            invite.id,
          );
        }

        const user = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                organizationId: invite.organizationId,
                displayName,
                email: email ?? undefined,
              },
              select: userSelect,
            })
          : await tx.user.create({
              data: {
                auth0Sub,
                email: email ?? null,
                displayName,
                organizationId: invite.organizationId,
              },
              select: userSelect,
            });

        const claim = await tx.orgInvite.updateMany({
          where: {
            id: invite.id,
            usedAt: null,
            expiresAt: { gt: claimedAt },
          },
          data: {
            usedAt: claimedAt,
            usedById: user.id,
          },
        });

        if (claim.count !== 1) {
          throw new InviteJoinError(
            409,
            "INVITE_USED",
            "This invite link has already been used.",
            invite.id,
          );
        }

        return {
          user,
          created: !existingUser,
          inviteId: invite.id,
          organizationId: invite.organizationId,
        };
      });

      info(request.log, "orgs.join.success", {
        userId: result.user.id,
        orgId: result.organizationId,
        inviteId: result.inviteId,
      });
      return reply.status(200).send({
        ...mapAppUser(result.user),
        created: result.created,
      });
    } catch (err) {
      if (!(err instanceof InviteJoinError)) {
        throw err;
      }

      const event =
        err.code === "INVITE_NOT_FOUND"
          ? "orgs.join.invalid_token"
          : err.code === "INVITE_EXPIRED"
            ? "orgs.join.token_expired"
            : err.code === "INVITE_USED"
              ? "orgs.join.token_already_used"
              : "orgs.join.already_in_org";

      warn(request.log, event, {
        auth0Sub,
        inviteId: err.inviteId,
      });
      return reply.status(err.statusCode).send({
        code: err.code,
        message: err.message,
      });
    }
  });
}
