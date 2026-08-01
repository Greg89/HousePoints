import { describe, expect, it } from "vitest";

import {
  buildInviteShareMessage,
  buildInviteUrl,
  formatInviteExpiration,
} from "./invite-sharing";

describe("invite sharing", () => {
  it("builds an absolute join URL without duplicate slashes", () => {
    expect(
      buildInviteUrl(
        "https://housepoints.example/",
        "/o/acme/join/token-1",
      ),
    ).toBe("https://housepoints.example/o/acme/join/token-1");
  });

  it("normalizes a join path without a leading slash", () => {
    expect(buildInviteUrl("https://housepoints.example", "o/acme/join/t")).toBe(
      "https://housepoints.example/o/acme/join/t",
    );
  });

  it("includes the organization and URL in the share message", () => {
    expect(
      buildInviteShareMessage("Acme Guild", "https://example.test/invite"),
    ).toBe(
      "Join Acme Guild on HousePoints:\nhttps://example.test/invite",
    );
  });

  it("formats a valid expiration for display", () => {
    expect(
      formatInviteExpiration("2099-01-01T00:00:00.000Z"),
    ).not.toContain("Invalid");
  });
});

