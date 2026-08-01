import type { AdminUser } from "@housepoints/contracts";

export type MemberManagementActorRole = "ADMIN" | "OWNER";

export function filterAdminUsers(
  users: AdminUser[],
  search: string,
): AdminUser[] {
  const term = search.trim().toLowerCase();
  const sorted = [...users].sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );

  if (!term) {
    return sorted;
  }

  return sorted.filter(
    (user) =>
      user.displayName.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term),
  );
}

export function canManageMemberRole(
  actorRole: MemberManagementActorRole,
  targetRole: AdminUser["role"],
): boolean {
  return actorRole === "OWNER" && targetRole !== "OWNER";
}

export function canRemoveMember(
  actorRole: MemberManagementActorRole,
  targetRole: AdminUser["role"],
): boolean {
  return actorRole === "OWNER" && targetRole !== "OWNER";
}

