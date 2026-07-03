import { getCurrentUserForRequest } from "@/lib/current-user";
import { logWarn } from "@/lib/logging";

type CurrentUserMapping = Awaited<ReturnType<typeof getCurrentUserForRequest>>;

export async function getActorMappingForAdmin(action: string, requestId: string) {
  const mapping = resolveActiveActorMapping(await getCurrentUserForRequest(requestId));

  if (mapping.role !== "ADMIN" && mapping.role !== "OWNER") {
    logWarn("web.admin.forbidden", {
      action,
      requestId,
      actorUserId: mapping.id,
      role: mapping.role,
    });
    throw new Error("Admin role required");
  }

  return mapping;
}

export function resolveActiveActorMapping(mapping: CurrentUserMapping): CurrentUserMapping {
  const activeOrganizationContext =
    mapping.organizationContexts.find((context) => context.isCurrent) ??
    mapping.organizationContexts[0] ??
    null;

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
