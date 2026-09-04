import { describe, expect, it } from "vitest";

import {
  parseInviteInput,
  slugifyOrganizationName,
} from "./mobile-onboarding";

describe("slugifyOrganizationName", () => {
  it("creates a valid organization slug", () => {
    expect(slugifyOrganizationName("  Gregory's Beta Team!  ")).toBe(
      "gregorys-beta-team",
    );
  });
});

describe("parseInviteInput", () => {
  it("accepts a raw invite token", () => {
    expect(parseInviteInput(" invite-token ")).toEqual({
      inviteToken: "invite-token",
    });
  });

  it("extracts organization context from a web invite link", () => {
    expect(
      parseInviteInput(
        "https://beta.housepoints-ds.com/o/beta-team/join/invite-token",
      ),
    ).toEqual({
      inviteToken: "invite-token",
      organizationSlug: "beta-team",
    });
  });

  it("extracts a token from a native deep link", () => {
    expect(parseInviteInput("housepoints://invite/invite-token")).toEqual({
      inviteToken: "invite-token",
    });
  });

  it("rejects empty input", () => {
    expect(parseInviteInput("   ")).toBeNull();
  });
});
