import type { UserRole } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";

export type ActorRecord = {
  id: string;
  auth0Sub: string;
  displayName: string;
  membershipId: string | null;
  role: UserRole;
  houseId: string | null;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export function isOwnerRole(role: UserRole): boolean {
  return role === "OWNER";
}

const actorUserSelect = {
  id: true,
  displayName: true,
  role: true,
  houseId: true,
  organizationId: true,
  organization: {
    select: {
      name: true,
      slug: true,
    },
  },
  memberships: {
    where: {
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      role: true,
      houseId: true,
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
} as const;

export async function getActorBySub(auth0Sub: string): Promise<ActorRecord | null> {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: {
      user: {
        select: actorUserSelect,
      },
    },
  });
  const actor = identity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: actorUserSelect,
  });

  if (!actor) {
    return null;
  }

  const activeMembership = (actor.memberships ?? []).find(
    (membership) => membership.organizationId === actor.organizationId,
  );

  if (activeMembership) {
    return {
      id: actor.id,
      auth0Sub,
      displayName: actor.displayName,
      membershipId: activeMembership.id,
      role: activeMembership.role,
      houseId: activeMembership.houseId,
      organizationId: activeMembership.organizationId,
      organizationName: activeMembership.organization.name,
      organizationSlug: activeMembership.organization.slug,
    };
  }

  if (!actor.organizationId || !actor.organization) {
    return null;
  }

  return {
    id: actor.id,
    auth0Sub,
    displayName: actor.displayName,
    membershipId: null,
    role: actor.role,
    houseId: actor.houseId,
    organizationId: actor.organizationId,
    organizationName: actor.organization.name,
    organizationSlug: actor.organization.slug,
  };
}

export type UserOrgContext = {
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
};

export type UserRouteOrgContext = UserOrgContext & {
  requestedMembership: UserOrgContext | null;
};

/**
 * Resolves a user's organization context by Auth0 subject.
 * Returns null if the user does not exist. Returns an object with null org
 * fields if the user exists but has not yet joined an organization.
 * Used by routes that need to check org membership without requiring it.
 */
export async function getUserOrgContextBySub(auth0Sub: string): Promise<UserOrgContext | null> {
  const userSelect = {
    organizationId: true,
    organization: {
      select: {
        name: true,
        slug: true,
      },
    },
    memberships: {
      where: {
        isActive: true,
        archivedAt: null,
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    },
  } as const;

  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: { user: { select: userSelect } },
  });
  const user = identity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: userSelect,
  });

  if (!user) {
    return null;
  }

  return resolvePreferredOrgContext(user);
}

type PreferredOrgContextSource = {
  organizationId: string | null;
  organization: { name: string; slug: string } | null;
  memberships?: Array<{
    organizationId: string;
    organization: { name: string; slug: string };
  }>;
};

function resolvePreferredOrgContext(user: PreferredOrgContextSource): UserOrgContext {
  const activeMemberships = user.memberships ?? [];
  const legacyCurrentMembership = activeMemberships.find(
    (membership) => membership.organizationId === user.organizationId,
  );
  const preferredMembership = legacyCurrentMembership ?? activeMemberships[0] ?? null;

  if (preferredMembership) {
    return {
      organizationId: preferredMembership.organizationId,
      organizationName: preferredMembership.organization.name,
      organizationSlug: preferredMembership.organization.slug,
    };
  }

  return {
    organizationId: user.organizationId,
    organizationName: user.organization?.name ?? null,
    organizationSlug: user.organization?.slug ?? null,
  };
}

export async function getUserRouteOrgContextBySub(
  auth0Sub: string,
  requestedOrganizationId: string,
): Promise<UserRouteOrgContext | null> {
  const userSelect = {
    organizationId: true,
    organization: {
      select: {
        name: true,
        slug: true,
      },
    },
    memberships: {
      where: {
        isActive: true,
        archivedAt: null,
      },
      select: {
        organizationId: true,
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    },
  } as const;

  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: { user: { select: userSelect } },
  });
  const user = identity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: userSelect,
  });

  if (!user) {
    return null;
  }

  const requestedMembership = (user.memberships ?? []).find(
    (membership) => membership.organizationId === requestedOrganizationId,
  );

  return {
    ...resolvePreferredOrgContext(user),
    requestedMembership: requestedMembership
      ? {
          organizationId: requestedMembership.organizationId,
          organizationName: requestedMembership.organization.name,
          organizationSlug: requestedMembership.organization.slug,
        }
      : null,
  };
}
