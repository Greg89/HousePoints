import { getCurrentUserForRequest } from "@/lib/current-user";
import { logWarn } from "@/lib/logging";

export async function getActorMappingForAdmin(action: string, requestId: string) {
  const mapping = await getCurrentUserForRequest(requestId);

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
