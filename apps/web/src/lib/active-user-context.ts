import type { AppUser, AppUserOrganizationContext } from "@housepoints/contracts";

type AppUserWithContexts = Pick<AppUser, "organizationContexts">;

export function resolveActiveOrganizationContext(
  mapping: AppUserWithContexts,
  activeOrganizationSlug?: string | null,
): AppUserOrganizationContext | null {
  return (
    mapping.organizationContexts.find((context) => context.organizationSlug === activeOrganizationSlug) ??
    mapping.organizationContexts.find((context) => context.isCurrent) ??
    mapping.organizationContexts[0] ??
    null
  );
}

export function resolveActiveAppUserMapping<T extends AppUser>(
  mapping: T,
  activeOrganizationSlug?: string | null,
): T {
  const activeOrganizationContext = resolveActiveOrganizationContext(mapping, activeOrganizationSlug);

  if (!activeOrganizationContext) {
    return mapping;
  }

  return {
    ...mapping,
    role: activeOrganizationContext.role,
    organizationId: activeOrganizationContext.organizationId,
    organizationSlug: activeOrganizationContext.organizationSlug,
    houseId: activeOrganizationContext.houseId,
    houseName: activeOrganizationContext.houseName,
    houseColor: activeOrganizationContext.houseColor,
  };
}
