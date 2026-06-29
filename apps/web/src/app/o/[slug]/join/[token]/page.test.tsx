import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { previewInviteLink } from "@/app/actions/orgs";
import InviteJoinPage from "./page";

vi.mock("@/app/actions/orgs", () => ({
  previewInviteLink: vi.fn(),
}));

const previewInviteLinkMock = vi.mocked(previewInviteLink);

describe("InviteJoinPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an already-member state for users in the invite organization", async () => {
    previewInviteLinkMock.mockResolvedValue({
      ok: true,
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "SAME_ORG",
      memberOrganizationName: "Acme Corp",
      memberOrganizationSlug: "acme",
    });

    render(await InviteJoinPage({
      params: Promise.resolve({ slug: "acme", token: "invite-token" }),
    }));

    expect(screen.getByRole("heading", { name: "You're already a member" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: /join organisation/i })).not.toBeInTheDocument();
  });

  it("shows a blocked state for users in a different organization", async () => {
    previewInviteLinkMock.mockResolvedValue({
      ok: true,
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "OTHER_ORG",
      memberOrganizationName: "Other Org",
      memberOrganizationSlug: "other-org",
    });

    render(await InviteJoinPage({
      params: Promise.resolve({ slug: "acme", token: "invite-token" }),
    }));

    expect(
      screen.getByRole("heading", { name: "This account is already in another organisation" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/belongs to Other Org/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", "/auth/logout");
    expect(screen.queryByRole("button", { name: /join organisation/i })).not.toBeInTheDocument();
  });
});
