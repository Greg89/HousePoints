import { describe, expect, it } from "vitest";
import { manageAttention, selectManageMembers } from "./manage-overview";
import type { AdminUser } from "@housepoints/contracts";
const users: AdminUser[] = [
  { id: "1", displayName: "Zoe", email: "z@example.com", role: "MEMBER", houseId: null },
  { id: "2", displayName: "Alex", email: null, role: "ADMIN", houseId: "h1" },
  { id: "3", displayName: "Sam", email: "owner@example.com", role: "OWNER", houseId: "h2" },
];
describe("manage directory", () => {
  it("combines search, house, and access filters without mutating the source", () => {
    expect(selectManageMembers(users, "", "all").map(u => u.id)).toEqual(["2", "3", "1"]);
    expect(selectManageMembers(users, "OWNER@", "admins", "h2").map(u => u.id)).toEqual(["3"]);
    expect(selectManageMembers(users, "", "unassigned").map(u => u.id)).toEqual(["1"]);
    expect(selectManageMembers(users, "", "unassigned", "h1")).toEqual([]);
    expect(users[0].id).toBe("1");
  });
  it("identifies setup work by house IDs", () => {
    const house = { name: "House", color: "#123456", description: null, themeMode: "GENERATED" as const, themeSecondaryColor: null, themeSurfaceColor: null };
    const result = manageAttention({ users, houses: [{ ...house, id: "h1" }, { ...house, id: "h2" }, { ...house, id: "h3" }] });
    expect(result.unassigned).toBe(1);
    expect(result.emptyHouses.map(h => h.id)).toEqual(["h3"]);
    expect(manageAttention({ users: [], houses: [] })).toEqual({ unassigned: 0, emptyHouses: [] });
  });
});
