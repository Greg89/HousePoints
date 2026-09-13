import type { AppUserOrganizationContext } from "@housepoints/contracts";
import { describe, expect, it } from "vitest";

import { organizationOptions } from "./organization-selector";

const memberships: AppUserOrganizationContext[] = [
  {
    organizationId: "org-1",
    organizationName: "Alpha Organization",
    organizationSlug: "alpha",
    role: "MEMBER",
    houseId: "house-1",
    houseName: "Phoenix",
    houseColor: "#dc2626",
    isCurrent: false,
  },
  {
    organizationId: "org-2",
    organizationName: "Beta Organization",
    organizationSlug: "beta",
    role: "ADMIN",
    houseId: "house-2",
    houseName: "Dragon",
    houseColor: "#2563eb",
    isCurrent: true,
  },
  {
    organizationId: "org-3",
    organizationName: "Gamma Organization",
    organizationSlug: "gamma",
    role: "OWNER",
    houseId: null,
    houseName: null,
    houseColor: null,
    isCurrent: false,
  },
  {
    organizationId: "org-4",
    organizationName: "Delta Organization",
    organizationSlug: "delta",
    role: "MEMBER",
    houseId: "house-4",
    houseName: "Griffin",
    houseColor: "#16a34a",
    isCurrent: false,
  },
];

describe("organizationOptions", () => {
  it("keeps every membership in its original order and marks the active one", () => {
    const options = organizationOptions(memberships, "beta");

    expect(options.map(({ membership }) => membership.organizationSlug)).toEqual([
      "alpha",
      "beta",
      "gamma",
      "delta",
    ]);
    expect(options.filter(({ selected }) => selected)).toEqual([
      { membership: memberships[1], selected: true },
    ]);
  });

  it("does not mark an option when there is no active organization", () => {
    expect(organizationOptions(memberships, null).every(({ selected }) => !selected)).toBe(
      true,
    );
  });
});
