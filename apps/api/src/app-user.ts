import type { Prisma } from "@prisma/client";
import { pickPreferredMembership } from "./membership-context.js";

export const APP_USER_SELECT = {
  id: true,
  auth0Sub: true,
  email: true,
  displayName: true,
  houseThemeEnabled: true,
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
      organization: {
        archivedAt: null,
      },
    },
    orderBy: { organization: { name: "asc" } },
    select: {
      organizationId: true,
      role: true,
      houseId: true,
      organization: { select: { name: true, slug: true } },
      house: { select: { name: true, color: true } },
    },
  },
} as const;

export function mapAppUser(user: Prisma.UserGetPayload<{ select: typeof APP_USER_SELECT }>) {
  const activeMemberships = user.memberships ?? [];
  const currentMembership = pickPreferredMembership(activeMemberships);
  const currentOrganizationId = currentMembership?.organizationId ?? null;

  const organizationContexts = activeMemberships.map((membership) => ({
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
    houseId: membership.houseId,
    houseName: membership.house?.name ?? null,
    houseColor: membership.house?.color ?? null,
    isCurrent: membership.organizationId === currentOrganizationId,
  }));

  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    houseThemeEnabled: user.houseThemeEnabled,
    role: currentMembership?.role ?? "MEMBER",
    organizationId: currentMembership?.organizationId ?? null,
    organizationSlug: currentMembership?.organization.slug ?? null,
    houseId: currentMembership?.houseId ?? null,
    houseName: currentMembership?.house?.name ?? null,
    houseColor: currentMembership?.house?.color ?? null,
    organizationContexts,
  };
}
