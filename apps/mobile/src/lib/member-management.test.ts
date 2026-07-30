import { describe, expect, it } from "vitest";

import {
  canManageMemberRole,
  canRemoveMember,
  filterAdminUsers,
} from "./member-management";

const users = [
  {
    id: "2",
    displayName: "Zoe Owner",
    email: "zoe@example.com",
    role: "OWNER" as const,
    houseId: null,
  },
  {
    id: "1",
    displayName: "Alex Member",
    email: "alex@example.com",
    role: "MEMBER" as const,
    houseId: "house-1",
  },
];

describe("filterAdminUsers", () => {
  it("sorts members by display name", () => {
    expect(filterAdminUsers(users, "").map((user) => user.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("matches display names and email addresses case-insensitively", () => {
    expect(filterAdminUsers(users, "MEMBER").map((user) => user.id)).toEqual([
      "1",
    ]);
    expect(filterAdminUsers(users, "ZOE@").map((user) => user.id)).toEqual([
      "2",
    ]);
  });
});

describe("member permissions", () => {
  it("reserves role and removal controls for owners", () => {
    expect(canManageMemberRole("ADMIN", "MEMBER")).toBe(false);
    expect(canRemoveMember("ADMIN", "MEMBER")).toBe(false);
    expect(canManageMemberRole("OWNER", "MEMBER")).toBe(true);
    expect(canRemoveMember("OWNER", "ADMIN")).toBe(true);
  });

  it("never exposes role or removal controls for an owner target", () => {
    expect(canManageMemberRole("OWNER", "OWNER")).toBe(false);
    expect(canRemoveMember("OWNER", "OWNER")).toBe(false);
  });
});

