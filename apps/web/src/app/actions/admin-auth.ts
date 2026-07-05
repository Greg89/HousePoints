import { readActiveOrganizationSlug } from "@/lib/active-organization";
import { resolveActiveAppUserMapping } from "@/lib/active-user-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { logWarn } from "@/lib/logging";

type CurrentUserMapping = Awaited<ReturnType<typeof getCurrentUserForRequest>>;

export async function getActorMappingForAdmin(action: string, requestId: string) {
  const activeOrganizationSlug = await readActiveOrganizationSlug();
  const mapping = resolveActiveActorMapping(
    await getCurrentUserForRequest(requestId),
    activeOrganizationSlug,
  );

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

export function resolveActiveActorMapping(
  mapping: CurrentUserMapping,
  activeOrganizationSlug?: string | null,
): CurrentUserMapping {
  return resolveActiveAppUserMapping(mapping, activeOrganizationSlug);
}
