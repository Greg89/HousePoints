import type { UserRole } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";

export type ActorRecord = {
  id: string;
  auth0Sub: string;
  role: UserRole;
  houseId: string | null;
  organizationId: string;
  organizationSlug: string;
};

export function isAdminRole(role: UserRole): boolean {
  return role === "ADMIN" || role === "OWNER";
}

export async function getActorBySub(auth0Sub: string): Promise<ActorRecord | null> {
  const identity = await prisma.authIdentity.findUnique({
    where: { providerSubject: auth0Sub },
    select: {
      user: {
        select: {
          id: true,
          role: true,
          houseId: true,
          organizationId: true,
          organization: {
            select: {
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
      role: true,
      houseId: true,
      organizationId: true,
      organization: {
        select: {
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
    role: actor.role,
    houseId: actor.houseId,
    organizationId: actor.organizationId,
    organizationSlug: actor.organization.slug,
  };
}
