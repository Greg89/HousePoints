import type { Prisma } from "@prisma/client";

export const APP_USER_SELECT = {
  id: true,
  auth0Sub: true,
  email: true,
  displayName: true,
  houseThemeEnabled: true,
  role: true,
  organizationId: true,
  organization: { select: { name: true, slug: true } },
  houseId: true,
  house: { select: { name: true, color: true } },
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
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
  const currentOrganizationId =
    activeMemberships.find((membership) => membership.organizationId === user.organizationId)
      ?.organizationId ??
    activeMemberships[0]?.organizationId ??
    user.organizationId;

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

  if (
    user.organizationId &&
    user.organization &&
    !organizationContexts.some((context) => context.organizationId === user.organizationId)
  ) {
    organizationContexts.push({
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationSlug: user.organization.slug,
      role: user.role,
      houseId: user.houseId,
      houseName: user.house?.name ?? null,
      houseColor: user.house?.color ?? null,
      isCurrent: true,
    });
  }

  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    houseThemeEnabled: user.houseThemeEnabled,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization?.slug ?? null,
    houseId: user.houseId,
    houseName: user.house?.name ?? null,
    houseColor: user.house?.color ?? null,
    organizationContexts,
  };
}
