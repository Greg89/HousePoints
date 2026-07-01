import type { UserRole } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";

export type ActorRecord = {
  id: string;
  auth0Sub: string;
  displayName: string;
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

export async function getActorBySub(auth0Sub: string): Promise<ActorRecord | null> {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: {
      user: {
        select: {
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
        },
      },
    },
  });
  const actor = identity?.user ?? await prisma.user.findUnique({
    where: { auth0Sub },
    select: {
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
    },
  });

  if (!actor) {
    return null;
  }

  if (!actor.organizationId || !actor.organization) {
    return null;
  }

  return {
    id: actor.id,
    auth0Sub,
    displayName: actor.displayName,
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

  return {
    organizationId: user.organizationId,
    organizationName: user.organization?.name ?? null,
    organizationSlug: user.organization?.slug ?? null,
  };
}
