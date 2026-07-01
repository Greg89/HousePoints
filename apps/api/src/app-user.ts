import type { Prisma } from "@prisma/client";

export const APP_USER_SELECT = {
  id: true,
  auth0Sub: true,
  email: true,
  displayName: true,
  houseThemeEnabled: true,
  role: true,
  organizationId: true,
  organization: { select: { slug: true } },
  houseId: true,
  house: { select: { name: true, color: true } },
} as const;

export function mapAppUser(user: Prisma.UserGetPayload<{ select: typeof APP_USER_SELECT }>) {
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
  };
}
