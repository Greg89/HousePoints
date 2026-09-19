import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  platformOverviewRequestSchema,
  platformOrganizationDetailRequestSchema,
  updatePlatformOrganizationStatusSchema,
  updatePlatformSettingsSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { OrganizationCreationPolicy } from "../config.js";
import { info, warn } from "../logging.js";
import {
  readEffectiveOrganizationCreationPolicy,
} from "../organization-capacity.js";
import { parseBody } from "../route-helpers.js";

type PlatformRouteOptions = {
  hardOrganizationCreationPolicy: OrganizationCreationPolicy;
  platformOwnerAuth0Subjects: ReadonlySet<string>;
};

function requirePlatformOwner(
  request: FastifyRequest,
  reply: FastifyReply,
  subjects: ReadonlySet<string>,
): boolean {
  if (subjects.has(request.auth.subject)) return true;

  warn(request.log, "platform.owner_required", {});
  void reply.status(403).send({
    code: "PLATFORM_OWNER_REQUIRED",
    message: "Platform owner access is required",
  });
  return false;
}

async function readSettings(hardPolicy: OrganizationCreationPolicy) {
  const stored = await prisma.platformSettings.findUnique({ where: { id: "global" } });
  const effective = await readEffectiveOrganizationCreationPolicy(prisma, hardPolicy);
  return {
    organizationCreationEnabled: stored?.organizationCreationEnabled ?? true,
    maxActiveOrganizations: stored?.maxActiveOrganizations ?? hardPolicy.maxActiveOrganizations,
    hardOrganizationCreationEnabled: hardPolicy.enabled,
    hardMaxActiveOrganizations: hardPolicy.maxActiveOrganizations,
    effectiveOrganizationCreationEnabled: effective.enabled,
    effectiveMaxActiveOrganizations: effective.maxActiveOrganizations,
  };
}

export async function registerPlatformRoutes(
  app: FastifyInstance,
  options: PlatformRouteOptions,
): Promise<void> {
  app.post("/platform/overview", async (request, reply) => {
    const parsed = await parseBody(platformOverviewRequestSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;

    const [organizations, totalMemberCount, recentAuditEvents, settings] = await Promise.all([
      prisma.organization.findMany({
        orderBy: [{ archivedAt: "asc" }, { createdAt: "desc" }],
        take: 250,
        select: {
          id: true,
          name: true,
          slug: true,
          archivedAt: true,
          suspendedAt: true,
          createdAt: true,
          memberships: {
            where: { isActive: true, archivedAt: null },
            select: { role: true },
          },
          transactions: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.organizationMembership.count({ where: { isActive: true, archivedAt: null } }),
      prisma.platformAuditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          actorAuth0Sub: true,
          eventType: true,
          summary: true,
          createdAt: true,
        },
      }),
      readSettings(options.hardOrganizationCreationPolicy),
    ]);

    const activeOrganizationCount = organizations.filter((organization) => !organization.archivedAt).length;
    return reply.status(200).send({
      activeOrganizationCount,
      archivedOrganizationCount: organizations.length - activeOrganizationCount,
      totalMemberCount,
      settings,
      organizations: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.archivedAt ? "ARCHIVED" : organization.suspendedAt ? "SUSPENDED" : "ACTIVE",
        memberCount: organization.memberships.length,
        ownerCount: organization.memberships.filter((membership) => membership.role === "OWNER").length,
        lastActivityAt: organization.transactions[0]?.createdAt.toISOString() ?? null,
        createdAt: organization.createdAt.toISOString(),
      })),
      recentAuditEvents: recentAuditEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    });
  });

  app.post("/platform/organizations/detail", async (request, reply) => {
    const parsed = await parseBody(platformOrganizationDetailRequestSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const organization = await prisma.organization.findUnique({
      where: { id: parsed.organizationId },
      select: {
        id: true, name: true, slug: true, archivedAt: true, suspendedAt: true, suspensionReason: true, createdAt: true,
        memberships: { where: { isActive: true, archivedAt: null }, select: { role: true, user: { select: { id: true, displayName: true, email: true } } } },
        transactions: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } },
        invites: { where: { usedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } },
        deviceRegistrations: { where: { revokedAt: null }, select: { id: true } },
        auditEvents: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, eventType: true, summary: true, createdAt: true } },
      },
    });
    if (!organization) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    const owners = organization.memberships.filter((membership) => membership.role === "OWNER").map((membership) => membership.user);
    return reply.status(200).send({
      organization: {
        id: organization.id, name: organization.name, slug: organization.slug,
        status: organization.archivedAt ? "ARCHIVED" : organization.suspendedAt ? "SUSPENDED" : "ACTIVE",
        memberCount: organization.memberships.length, ownerCount: owners.length,
        lastActivityAt: organization.transactions[0]?.createdAt.toISOString() ?? null, createdAt: organization.createdAt.toISOString(),
        archivedAt: organization.archivedAt?.toISOString() ?? null, suspendedAt: organization.suspendedAt?.toISOString() ?? null,
        suspensionReason: organization.suspensionReason, transactionCount: organization.transactions.length,
        activeInviteCount: organization.invites.length, deviceCount: organization.deviceRegistrations.length,
      },
      owners,
      recentAuditEvents: organization.auditEvents.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    });
  });

  app.post("/platform/organizations/status", async (request, reply) => {
    const parsed = await parseBody(updatePlatformOrganizationStatusSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const existing = await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true, name: true, slug: true, archivedAt: true, suspendedAt: true } });
    if (!existing) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    if (existing.slug !== parsed.confirmationSlug) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation slug does not match" });
    if (existing.archivedAt) return reply.status(409).send({ code: "ORGANIZATION_ARCHIVED", message: "Archived organizations cannot be suspended or resumed" });
    const suspendedAt = parsed.action === "SUSPEND" ? new Date() : null;
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: existing.id }, data: { suspendedAt, suspendedByAuth0Sub: suspendedAt ? request.auth.subject : null, suspensionReason: suspendedAt ? parsed.reason : null } });
      await tx.platformAuditEvent.create({ data: {
        actorAuth0Sub: request.auth.subject,
        eventType: parsed.action === "SUSPEND" ? "ORGANIZATION_SUSPENDED" : "ORGANIZATION_RESUMED",
        summary: `${existing.name} was ${parsed.action === "SUSPEND" ? "suspended" : "resumed"}.`,
        metadata: { organizationId: existing.id, organizationSlug: existing.slug, reason: parsed.reason ?? null },
      } });
    });
    info(request.log, parsed.action === "SUSPEND" ? "platform.organization.suspended" : "platform.organization.resumed", { organizationId: existing.id });
    return reply.status(200).send({ id: existing.id, status: suspendedAt ? "SUSPENDED" : "ACTIVE", suspendedAt: suspendedAt?.toISOString() ?? null });
  });

  app.post("/platform/settings", async (request, reply) => {
    const parsed = await parseBody(updatePlatformSettingsSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;

    const hardMax = options.hardOrganizationCreationPolicy.maxActiveOrganizations;
    if (hardMax !== null && parsed.maxActiveOrganizations !== null && parsed.maxActiveOrganizations > hardMax) {
      return reply.status(409).send({
        code: "PLATFORM_HARD_CAP_EXCEEDED",
        message: `The operating limit cannot exceed the Railway hard limit of ${hardMax}.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformSettings.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          organizationCreationEnabled: parsed.organizationCreationEnabled,
          maxActiveOrganizations: parsed.maxActiveOrganizations,
          updatedByAuth0Sub: request.auth.subject,
        },
        update: {
          organizationCreationEnabled: parsed.organizationCreationEnabled,
          maxActiveOrganizations: parsed.maxActiveOrganizations,
          updatedByAuth0Sub: request.auth.subject,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorAuth0Sub: request.auth.subject,
          eventType: "PLATFORM_SETTINGS_UPDATED",
          summary: "Platform organization capacity settings were updated.",
          metadata: parsed,
        },
      });
    });

    info(request.log, "platform.settings.updated", {
      organizationCreationEnabled: parsed.organizationCreationEnabled,
      maxActiveOrganizations: parsed.maxActiveOrganizations,
    });
    return reply.status(200).send(await readSettings(options.hardOrganizationCreationPolicy));
  });
}
