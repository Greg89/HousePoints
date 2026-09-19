import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  platformOverviewRequestSchema,
  platformOrganizationDetailRequestSchema,
  updatePlatformOrganizationStatusSchema,
  revokePlatformOrganizationInvitesSchema,
  revokePlatformOrganizationInviteSchema,
  updatePlatformSettingsSchema,
  platformUserSearchSchema,
  revokePlatformUserDevicesSchema,
  platformAccountDeletionQueueRequestSchema,
  completePlatformAccountDeletionSchema,
  listPlatformSupportCasesSchema,
  createPlatformSupportCaseSchema,
  readPlatformSupportCaseSchema,
  updatePlatformSupportCaseSchema,
  addPlatformSupportNoteSchema,
  submitModerationReportSchema,
  listPlatformModerationReportsSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { Prisma } from "@prisma/client";
import type { OrganizationCreationPolicy } from "../config.js";
import { info, warn } from "../logging.js";
import {
  readEffectiveOrganizationCreationPolicy,
  assertOrganizationCapacity,
  OrganizationCapacityError,
} from "../organization-capacity.js";
import { parseBody, requireActor } from "../route-helpers.js";

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
  app.post("/moderation/reports/submit", async (request, reply) => {
    const parsed = await parseBody(submitModerationReportSchema, request, reply);
    if (!parsed) return;
    const actor = await requireActor(request, reply);
    if (!actor) return;
    let evidenceSnapshot: Prisma.InputJsonObject;
    if (parsed.targetType === "POINT_TRANSACTION") {
      const point = await prisma.pointTransaction.findFirst({ where: { id: parsed.targetId, organizationId: actor.organizationId }, select: { id: true, type: true, delta: true, reason: true, trait: true, createdAt: true, actor: { select: { id: true, displayName: true } }, targetUser: { select: { id: true, displayName: true } }, targetHouse: { select: { id: true, name: true } } } });
      if (!point) return reply.status(404).send({ code: "REPORT_TARGET_NOT_FOUND", message: "Report target not found" });
      evidenceSnapshot = { ...point, createdAt: point.createdAt.toISOString() };
    } else {
      const membership = await prisma.organizationMembership.findFirst({ where: { organizationId: actor.organizationId, userId: parsed.targetId }, select: { role: true, isActive: true, user: { select: { id: true, displayName: true } } } });
      if (!membership) return reply.status(404).send({ code: "REPORT_TARGET_NOT_FOUND", message: "Report target not found" });
      evidenceSnapshot = { userId: membership.user.id, displayName: membership.user.displayName, role: membership.role, membershipActive: membership.isActive };
    }
    const report = await prisma.moderationReport.create({ data: { organizationId: actor.organizationId, reporterUserId: actor.id, targetType: parsed.targetType, targetId: parsed.targetId, category: parsed.category, details: parsed.details, evidenceSnapshot }, select: { id: true } });
    info(request.log, "moderation.report.submitted", { reportId: report.id, organizationId: actor.organizationId, targetType: parsed.targetType, targetId: parsed.targetId, category: parsed.category });
    return reply.status(201).send(report);
  });

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
        invites: { where: { usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, expiresAt: true, createdBy: { select: { displayName: true } } } },
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
      activeInvites: organization.invites.map((invite) => ({ id: invite.id, createdByName: invite.createdBy.displayName, createdAt: invite.createdAt.toISOString(), expiresAt: invite.expiresAt.toISOString() })),
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
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "ORGANIZATION_INVITES_REVOKED", summary: `${revokedCount} outstanding invite${revokedCount === 1 ? "" : "s"} for ${organization.name} were revoked.`, metadata: { organizationId: organization.id, organizationSlug: organization.slug, revokedCount, reason: parsed.reason } } });
    });
    info(request.log, "platform.organization.invites_revoked", { organizationId: organization.id, revokedCount });
    return reply.status(200).send({ revokedCount });
  });

  app.post("/platform/organizations/revoke-invite", async (request, reply) => {
    const parsed = await parseBody(revokePlatformOrganizationInviteSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const organization = await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true, name: true, slug: true } });
    if (!organization) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    if (organization.slug !== parsed.confirmationSlug) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation slug does not match" });
    const revokedAt = new Date();
    let revoked = false;
    await prisma.$transaction(async (tx) => {
      const result = await tx.orgInvite.updateMany({ where: { id: parsed.inviteId, organizationId: organization.id, usedAt: null, expiresAt: { gt: revokedAt } }, data: { expiresAt: revokedAt } });
      revoked = result.count > 0;
      if (revoked) await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "ORGANIZATION_INVITE_REVOKED", summary: `An outstanding invite for ${organization.name} was revoked.`, metadata: { organizationId: organization.id, organizationSlug: organization.slug, inviteId: parsed.inviteId, reason: parsed.reason } } });
    });
    if (!revoked) return reply.status(409).send({ code: "INVITE_NOT_ACTIVE", message: "The invitation is no longer active" });
    info(request.log, "platform.organization.invite_revoked", { organizationId: organization.id, inviteId: parsed.inviteId });
    return reply.status(200).send({ revoked: true });
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

  app.post("/platform/users/search", async (request, reply) => {
    const parsed = await parseBody(platformUserSearchSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const query = parsed.query;
    const users = await prisma.user.findMany({
      where: { OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { auth0Sub: { contains: query, mode: "insensitive" } },
        { authIdentities: { some: { providerSubject: { contains: query, mode: "insensitive" } } } },
      ] },
      orderBy: { displayName: "asc" }, take: 50,
      select: {
        id: true, displayName: true, email: true, auth0Sub: true, deletionRequestedAt: true,
        deviceRegistrations: { where: { revokedAt: null }, orderBy: { lastSeenAt: "desc" }, select: { id: true, organizationId: true, platform: true, appVersion: true, locale: true, createdAt: true, lastSeenAt: true, organization: { select: { name: true } } } },
        memberships: { select: { isActive: true, archivedAt: true, role: true, organizationId: true, organization: { select: { name: true, slug: true, archivedAt: true, suspendedAt: true } } } },
      },
    });
    return reply.status(200).send({ users: users.map((user) => ({
      id: user.id, displayName: user.displayName, email: user.email, auth0Sub: user.auth0Sub,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null, activeDeviceCount: user.deviceRegistrations.length,
      devices: user.deviceRegistrations.map((device) => ({ id: device.id, organizationId: device.organizationId, organizationName: device.organization.name, platform: device.platform, appVersion: device.appVersion, locale: device.locale, createdAt: device.createdAt.toISOString(), lastSeenAt: device.lastSeenAt.toISOString() })),
      memberships: user.memberships.map((membership) => {
        const membershipActive = membership.isActive && !membership.archivedAt;
        const organizationStatus = membership.organization.archivedAt ? "ARCHIVED" : membership.organization.suspendedAt ? "SUSPENDED" : "ACTIVE";
        const effectiveAccess = !membershipActive ? "BLOCKED_MEMBERSHIP" : organizationStatus !== "ACTIVE" ? "BLOCKED_ORGANIZATION" : "ALLOWED";
        const capabilities = effectiveAccess !== "ALLOWED" ? [] : ["VIEW_ORGANIZATION", "AWARD_POINTS", ...(membership.role === "ADMIN" || membership.role === "OWNER" ? ["MANAGE_MEMBERS"] : []), ...(membership.role === "OWNER" ? ["MANAGE_ORGANIZATION"] : [])];
        return { organizationId: membership.organizationId, organizationName: membership.organization.name, organizationSlug: membership.organization.slug, role: membership.role, membershipStatus: membershipActive ? "ACTIVE" : "INACTIVE", organizationStatus, effectiveAccess, capabilities };
      }),
    })) });
  });

  app.post("/platform/users/revoke-devices", async (request, reply) => {
    const parsed = await parseBody(revokePlatformUserDevicesSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const user = await prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true, displayName: true } });
    if (!user) return reply.status(404).send({ code: "USER_NOT_FOUND", message: "User not found" });
    if (user.displayName !== parsed.confirmationDisplayName) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation display name does not match" });
    const revokedAt = new Date();
    let revokedCount = 0;
    await prisma.$transaction(async (tx) => {
      const result = await tx.deviceRegistration.updateMany({ where: { userId: user.id, revokedAt: null, ...(parsed.deviceRegistrationId ? { id: parsed.deviceRegistrationId } : {}) }, data: { revokedAt } });
      revokedCount = result.count;
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: parsed.deviceRegistrationId ? "USER_DEVICE_REVOKED" : "USER_DEVICES_REVOKED", summary: `${revokedCount} active device registration${revokedCount === 1 ? "" : "s"} for ${user.displayName} were revoked.`, metadata: { userId: user.id, deviceRegistrationId: parsed.deviceRegistrationId ?? null, revokedCount, reason: parsed.reason } } });
    });
    info(request.log, "platform.user.devices_revoked", { userId: user.id, deviceRegistrationId: parsed.deviceRegistrationId ?? null, revokedCount });
    return reply.status(200).send({ revokedCount });
  });

  app.post("/platform/account-deletions", async (request, reply) => {
    const parsed = await parseBody(platformAccountDeletionQueueRequestSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const users = await prisma.user.findMany({
      where: { deletionRequestedAt: { not: null } },
      orderBy: { deletionRequestedAt: "asc" },
      take: 200,
      select: {
        id: true, displayName: true, email: true, deletionRequestedAt: true, deletionCompletedAt: true,
        deletionCompletedByAuth0Sub: true, deletionCompletionNote: true, deletionCompletionEvidence: true,
        memberships: { select: { role: true, organizationId: true, organization: { select: { name: true, archivedAt: true, memberships: { where: { role: "OWNER", isActive: true, archivedAt: null }, select: { userId: true } } } } } },
      },
    });
    const items = users.map((user) => {
      const lastOwnerConflicts = user.memberships
        .filter((membership) => membership.role === "OWNER" && !membership.organization.archivedAt && membership.organization.memberships.every((owner) => owner.userId === user.id))
        .map((membership) => ({ organizationId: membership.organizationId, organizationName: membership.organization.name }));
      return {
        userId: user.id, displayName: user.displayName, email: user.email,
        requestedAt: user.deletionRequestedAt!.toISOString(), completedAt: user.deletionCompletedAt?.toISOString() ?? null,
        completedByAuth0Sub: user.deletionCompletedByAuth0Sub, completionNote: user.deletionCompletionNote,
        evidence: user.deletionCompletionEvidence, membershipCount: user.memberships.length, lastOwnerConflicts,
      };
    });
    return reply.status(200).send({ pending: items.filter((item) => !item.completedAt), recentlyCompleted: items.filter((item) => item.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!)).slice(0, 50) });
  });

  app.post("/platform/account-deletions/complete", async (request, reply) => {
    const parsed = await parseBody(completePlatformAccountDeletionSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const user = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: {
        id: true, displayName: true, deletionRequestedAt: true, deletionCompletedAt: true,
        authIdentities: { select: { id: true } },
        memberships: { select: { role: true, organizationId: true, organization: { select: { name: true, archivedAt: true, memberships: { where: { role: "OWNER", isActive: true, archivedAt: null }, select: { userId: true } } } } } },
        _count: { select: { deviceRegistrations: true, notifications: true, pointReactions: true, pointTransactions: true, receivedTransactions: true } },
      },
    });
    if (!user || !user.deletionRequestedAt) return reply.status(404).send({ code: "ACCOUNT_DELETION_NOT_FOUND", message: "No account-deletion request was found" });
    const deletionRequestedAt = user.deletionRequestedAt;
    if (user.deletionCompletedAt) return reply.status(409).send({ code: "ACCOUNT_DELETION_ALREADY_COMPLETED", message: "Account deletion has already been completed" });
    if (user.displayName !== parsed.confirmationDisplayName) return reply.status(409).send({ code: "CONFIRMATION_MISMATCH", message: "The confirmation display name does not match" });
    const lastOwnerConflicts = user.memberships.filter((membership) => membership.role === "OWNER" && !membership.organization.archivedAt && membership.organization.memberships.every((owner) => owner.userId === user.id));
    if (lastOwnerConflicts.length) return reply.status(409).send({ code: "ACCOUNT_DELETION_OWNER_TRANSFER_REQUIRED", message: `Transfer ownership of ${lastOwnerConflicts.map((membership) => membership.organization.name).join(", ")} before completing deletion.` });
    const completedAt = new Date();
    const evidence = {
      deletedDeviceRegistrations: user._count.deviceRegistrations,
      deletedNotifications: user._count.notifications,
      deletedReactions: user._count.pointReactions,
      expiredInvitations: 0,
      retainedIdentityTombstones: user.authIdentities.length + 1,
      retainedMemberships: user.memberships.length,
      retainedHistoricalPointRecords: user._count.pointTransactions + user._count.receivedTransactions,
    };
    await prisma.$transaction(async (tx) => {
      await tx.deviceRegistration.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { recipientUserId: user.id } });
      await tx.pointReaction.deleteMany({ where: { actorUserId: user.id } });
      const inviteResult = await tx.orgInvite.updateMany({ where: { createdById: user.id, usedAt: null, expiresAt: { gt: completedAt } }, data: { expiresAt: completedAt } });
      evidence.expiredInvitations = inviteResult.count;
      await tx.organizationMembership.updateMany({ where: { userId: user.id }, data: { isActive: false, archivedAt: completedAt, houseId: null } });
      await tx.user.update({ where: { id: user.id }, data: { email: null, displayName: "Deleted user", houseThemeEnabled: false, deletionCompletedAt: completedAt, deletionCompletedByAuth0Sub: request.auth.subject, deletionCompletionNote: parsed.completionNote, deletionCompletionEvidence: evidence } });
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "ACCOUNT_DELETION_COMPLETED", summary: "An account-deletion request was completed.", metadata: { userId: user.id, requestedAt: deletionRequestedAt.toISOString(), completedAt: completedAt.toISOString(), evidence } } });
    });
    info(request.log, "platform.account_deletion.completed", { userId: user.id, evidence });
    return reply.status(200).send({ userId: user.id, completedAt: completedAt.toISOString(), evidence });
  });

  app.post("/platform/support-cases/list", async (request, reply) => {
    const parsed = await parseBody(listPlatformSupportCasesSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const cases = await prisma.platformSupportCase.findMany({
      where: parsed.status ? { status: parsed.status } : undefined,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }], take: 200,
      select: { id: true, title: true, summary: true, status: true, priority: true, createdByAuth0Sub: true, resolvedAt: true, createdAt: true, updatedAt: true, organization: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, displayName: true, email: true } }, _count: { select: { notes: true } } },
    });
    return reply.status(200).send({ cases: cases.map(({ _count, ...supportCase }) => ({ ...supportCase, noteCount: _count.notes, resolvedAt: supportCase.resolvedAt?.toISOString() ?? null, createdAt: supportCase.createdAt.toISOString(), updatedAt: supportCase.updatedAt.toISOString() })) });
  });

  app.post("/platform/support-cases/create", async (request, reply) => {
    const parsed = await parseBody(createPlatformSupportCaseSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    if (parsed.organizationId && !await prisma.organization.findUnique({ where: { id: parsed.organizationId }, select: { id: true } })) return reply.status(404).send({ code: "ORGANIZATION_NOT_FOUND", message: "Organization not found" });
    if (parsed.userId && !await prisma.user.findUnique({ where: { id: parsed.userId }, select: { id: true } })) return reply.status(404).send({ code: "USER_NOT_FOUND", message: "User not found" });
    let supportCaseId = "";
    await prisma.$transaction(async (tx) => {
      const supportCase = await tx.platformSupportCase.create({ data: { title: parsed.title, summary: parsed.summary, priority: parsed.priority, organizationId: parsed.organizationId, userId: parsed.userId, createdByAuth0Sub: request.auth.subject }, select: { id: true } });
      supportCaseId = supportCase.id;
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "SUPPORT_CASE_CREATED", summary: "A private platform support case was created.", metadata: { supportCaseId, priority: parsed.priority, organizationId: parsed.organizationId ?? null, userId: parsed.userId ?? null } } });
    });
    info(request.log, "platform.support_case.created", { supportCaseId, priority: parsed.priority });
    return reply.status(201).send({ id: supportCaseId });
  });

  app.post("/platform/support-cases/detail", async (request, reply) => {
    const parsed = await parseBody(readPlatformSupportCaseSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const supportCase = await prisma.platformSupportCase.findUnique({ where: { id: parsed.supportCaseId }, select: { id: true, title: true, summary: true, status: true, priority: true, createdByAuth0Sub: true, resolvedAt: true, createdAt: true, updatedAt: true, organization: { select: { id: true, name: true, slug: true } }, user: { select: { id: true, displayName: true, email: true } }, notes: { orderBy: { createdAt: "asc" }, select: { id: true, authorAuth0Sub: true, body: true, createdAt: true } } } });
    if (!supportCase) return reply.status(404).send({ code: "SUPPORT_CASE_NOT_FOUND", message: "Support case not found" });
    return reply.status(200).send({ ...supportCase, noteCount: supportCase.notes.length, resolvedAt: supportCase.resolvedAt?.toISOString() ?? null, createdAt: supportCase.createdAt.toISOString(), updatedAt: supportCase.updatedAt.toISOString(), notes: supportCase.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })) });
  });

  app.post("/platform/support-cases/update", async (request, reply) => {
    const parsed = await parseBody(updatePlatformSupportCaseSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const existing = await prisma.platformSupportCase.findUnique({ where: { id: parsed.supportCaseId }, select: { id: true, status: true, priority: true } });
    if (!existing) return reply.status(404).send({ code: "SUPPORT_CASE_NOT_FOUND", message: "Support case not found" });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.platformSupportCase.update({ where: { id: existing.id }, data: { status: parsed.status, priority: parsed.priority, resolvedAt: parsed.status === "RESOLVED" ? now : null } });
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "SUPPORT_CASE_UPDATED", summary: "A private platform support case was updated.", metadata: { supportCaseId: existing.id, previousStatus: existing.status, status: parsed.status, previousPriority: existing.priority, priority: parsed.priority } } });
    });
    info(request.log, "platform.support_case.updated", { supportCaseId: existing.id, status: parsed.status, priority: parsed.priority });
    return reply.status(200).send({ updated: true });
  });

  app.post("/platform/support-cases/notes", async (request, reply) => {
    const parsed = await parseBody(addPlatformSupportNoteSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    if (!await prisma.platformSupportCase.findUnique({ where: { id: parsed.supportCaseId }, select: { id: true } })) return reply.status(404).send({ code: "SUPPORT_CASE_NOT_FOUND", message: "Support case not found" });
    await prisma.$transaction(async (tx) => {
      await tx.platformSupportNote.create({ data: { supportCaseId: parsed.supportCaseId, authorAuth0Sub: request.auth.subject, body: parsed.body } });
      await tx.platformSupportCase.update({ where: { id: parsed.supportCaseId }, data: { updatedAt: new Date() } });
      await tx.platformAuditEvent.create({ data: { actorAuth0Sub: request.auth.subject, eventType: "SUPPORT_CASE_NOTE_ADDED", summary: "A private note was added to a platform support case.", metadata: { supportCaseId: parsed.supportCaseId } } });
    });
    info(request.log, "platform.support_case.note_added", { supportCaseId: parsed.supportCaseId });
    return reply.status(200).send({ updated: true });
  });

  app.post("/platform/moderation/reports", async (request, reply) => {
    const parsed = await parseBody(listPlatformModerationReportsSchema, request, reply);
    if (!parsed || !requirePlatformOwner(request, reply, options.platformOwnerAuth0Subjects)) return;
    const [reports, totals] = await Promise.all([
      prisma.moderationReport.findMany({ where: parsed.status ? { status: parsed.status } : undefined, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, targetType: true, targetId: true, category: true, details: true, evidenceSnapshot: true, status: true, createdAt: true, updatedAt: true, organization: { select: { id: true, name: true, slug: true } }, reporter: { select: { id: true, displayName: true, email: true } } } }),
      prisma.moderationReport.groupBy({ by: ["targetType", "targetId"], _count: true }),
    ]);
    const counts = new Map(totals.map((total) => [`${total.targetType}:${total.targetId}`, total._count]));
    return reply.status(200).send({ reports: reports.map((report) => ({ ...report, evidenceSnapshot: report.evidenceSnapshot, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), priorReportCount: Math.max(0, (counts.get(`${report.targetType}:${report.targetId}`) ?? 1) - 1) })) });
  });
}
