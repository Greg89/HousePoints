import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  platformOverviewRequestSchema,
  platformOrganizationDetailRequestSchema,
  updatePlatformOrganizationStatusSchema,
  revokePlatformOrganizationInvitesSchema,
  updatePlatformSettingsSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { OrganizationCreationPolicy } from "../config.js";
import { info, warn } from "../logging.js";
import {
  readEffectiveOrganizationCreationPolicy,
  assertOrganizationCapacity,
  OrganizationCapacityError,
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
        errorSignals: { where: { lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, orderBy: { lastSeenAt: "desc" }, take: 20, select: { id: true, errorType: true, message: true, sourcePath: true, occurrenceCount: true, firstSeenAt: true, lastSeenAt: true } },
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
      recentErrorSignals: organization.errorSignals.map((signal) => ({ ...signal, firstSeenAt: signal.firstSeenAt.toISOString(), lastSeenAt: signal.lastSeenAt.toISOString() })),
      recentErrorOccurrenceCount: organization.errorSignals.reduce((total, signal) => total + signal.occurrenceCount, 0),
    });
  });

  app.post("/platform/organizations/status", async (request, reply) => {
    const parsed = await parseBody(updatePlatformOrganizationStatusSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const existing = await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true, name: true, slug: true, archivedAt: true, suspendedAt: true } });
    if (!existing) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    if (existing.slug !== parsed.confirmationSlug) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation slug does not match" });
    if ((parsed.action === "SUSPEND" || parsed.action === "RESUME") && existing.archivedAt) return reply.status(409).send({ code: "ORGANIZATION_ARCHIVED", message: "Archived organizations cannot be suspended or resumed" });
    if (parsed.action === "ARCHIVE" && existing.archivedAt) return reply.status(409).send({ code: "ORGANIZATION_ALREADY_ARCHIVED", message: "Organization is already archived" });
    if (parsed.action === "RESTORE" && !existing.archivedAt) return reply.status(409).send({ code: "ORGANIZATION_NOT_ARCHIVED", message: "Organization is not archived" });
    const now = new Date();
    try { await prisma.$transaction(async (tx) => {
      if (parsed.action === "RESTORE") await assertOrganizationCapacity(tx, options.hardOrganizationCreationPolicy);
      const data = parsed.action === "SUSPEND"
        ? { suspendedAt: now, suspendedByAuth0Sub: request.auth.subject, suspensionReason: parsed.reason }
        : parsed.action === "RESUME"
          ? { suspendedAt: null, suspendedByAuth0Sub: null, suspensionReason: null }
          : parsed.action === "ARCHIVE"
            ? { archivedAt: now, archivedById: null, suspendedAt: null, suspendedByAuth0Sub: null, suspensionReason: null }
            : { archivedAt: null, archivedById: null };
      await tx.organization.update({ where: { id: existing.id }, data });
      const pastTense = { SUSPEND: "suspended", RESUME: "resumed", ARCHIVE: "archived", RESTORE: "restored" }[parsed.action];
      await tx.platformAuditEvent.create({ data: {
        actorAuth0Sub: request.auth.subject,
        eventType: `ORGANIZATION_${pastTense.toUpperCase()}`,
        summary: `${existing.name} was ${pastTense}.`,
        metadata: { organizationId: existing.id, organizationSlug: existing.slug, reason: parsed.reason ?? null },
      } });
    }); } catch (error) {
      if (error instanceof OrganizationCapacityError) return reply.status(409).send({ code: error.code, message: error.message });
      throw error;
    }
    const status = parsed.action === "ARCHIVE" ? "ARCHIVED" : parsed.action === "SUSPEND" ? "SUSPENDED" : "ACTIVE";
    const logEvent = { SUSPEND: "platform.organization.suspended", RESUME: "platform.organization.resumed", ARCHIVE: "platform.organization.archived", RESTORE: "platform.organization.restored" } as const;
    info(request.log, logEvent[parsed.action], { organizationId: existing.id });
    return reply.status(200).send({ id: existing.id, status, suspendedAt: parsed.action === "SUSPEND" ? now.toISOString() : null, archivedAt: parsed.action === "ARCHIVE" ? now.toISOString() : null });
  });

  app.post("/platform/organizations/revoke-invites", async (request, reply) => {
    const parsed = await parseBody(revokePlatformOrganizationInvitesSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const organization = await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true, name: true, slug: true } });
    if (!organization) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    if (organization.slug !== parsed.confirmationSlug) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation slug does not match" });
    const revokedAt = new Date();
    let revokedCount = 0;
    await prisma.$transaction(async (tx) => {
      const result = await tx.orgInvite.updateMany({ where: { organizationId: organization.id, usedAt: null, expiresAt: { gt: revokedAt } }, data: { expiresAt: revokedAt } });
      revokedCount = result.count;
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "ORGANIZATION_INVITES_REVOKED", summary: `${revokedCount} outstanding invite${revokedCount === 1 ? "" : "s"} for ${organization.name} were revoked.`, metadata: { organizationId: organization.id, organizationSlug: organization.slug, revokedCount } } });
    });
    info(request.log, "platform.organization.invites_revoked", { organizationId: organization.id, revokedCount });
    return reply.status(200).send({ revokedCount });
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
