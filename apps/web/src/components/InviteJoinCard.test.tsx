import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { joinOrg } from "@/app/actions/orgs";
import { InviteJoinCard } from "./InviteJoinCard";

vi.mock("@/app/actions/orgs", () => ({
  joinOrg: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const joinOrgMock = vi.mocked(joinOrg);
const toastMock = vi.mocked(toast);

describe("InviteJoinCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    joinOrgMock.mockResolvedValue({ ok: true });
  });

  it("joins with both the invite token and organization slug", async () => {
    const user = userEvent.setup();
    const onJoined = vi.fn();

    render(
      <InviteJoinCard
        organizationName="Acme Corp"
        organizationSlug="acme"
        inviteToken="single-use-token"
        onJoined={onJoined}
      />,
    );

    await user.click(screen.getByRole("button", { name: /join organisation/i }));

    await waitFor(() => {
      expect(joinOrgMock).toHaveBeenCalledWith("single-use-token", "acme");
    });
    expect(toastMock.success).toHaveBeenCalledWith("You've joined the organisation!", {
      description: "Welcome to Acme Corp.",
    });
    expect(onJoined).toHaveBeenCalledOnce();
  });

  it("shows a safe error when the invite cannot be joined", async () => {
    const user = userEvent.setup();
    joinOrgMock.mockResolvedValue({
      ok: false,
      code: "INVITE_ORG_MISMATCH",
      message: "This invite link is not valid for this organisation.",
    });

    render(
      <InviteJoinCard
        organizationName="Acme Corp"
        organizationSlug="acme"
        inviteToken="single-use-token"
      />,
    );

    await user.click(screen.getByRole("button", { name: /join organisation/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith("Could not join organisation", {
        description: "This invite link is not valid for this organisation.",
      });
    });
  });
});
