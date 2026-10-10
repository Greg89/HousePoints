import type { AdminContext, AdminUser } from "@housepoints/contracts";
import { filterAdminUsers } from "./member-management";
export type MemberFilter = "all" | "unassigned" | "admins";
export function selectManageMembers(users: AdminUser[], search: string, filter: MemberFilter, houseId = "") {
  return filterAdminUsers(users, search).filter(user =>
    (filter !== "unassigned" || !user.houseId) &&
    (filter !== "admins" || user.role === "ADMIN" || user.role === "OWNER") &&
    (!houseId || user.houseId === houseId));
}
export function manageAttention(context: Pick<AdminContext, "users" | "houses">) {
  return {
    unassigned: context.users.filter(user => !user.houseId).length,
    emptyHouses: context.houses.filter(house => !context.users.some(user => user.houseId === house.id)),
  };
}
