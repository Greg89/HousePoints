import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { revokePlatformOrganizationInvite } from "@/app/actions/platform";
import { PlatformInvitationSupport } from "./PlatformInvitationSupport";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({ revokePlatformOrganizationInvite: vi.fn().mockResolvedValue({ ok: true }), revokePlatformOrganizationInvites: vi.fn().mockResolvedValue({ ok: true, revokedCount: 1 }) }));

const organization = { id: "org-1", name: "Acme", slug: "acme", status: "ACTIVE" as const, memberCount: 3, ownerCount: 1, lastActivityAt: null, createdAt: "2026-09-01T12:00:00.000Z", archivedAt: null, suspendedAt: null, suspensionReason: null, transactionCount: 5, activeInviteCount: 1, deviceCount: 2 };
const invites = [{ id: "invite-1", createdByName: "Alex Owner", createdAt: "2026-09-18T12:00:00.000Z", expiresAt: "2026-09-25T12:00:00.000Z" }];

describe("PlatformInvitationSupport", () => {
  it("requires confirmation and a reason before revoking one invite", async () => {
    const user = userEvent.setup();
    render(<PlatformInvitationSupport organization={organization} invites={invites} />);
    const button = screen.getByRole("button", { name: "Revoke invitation" });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Invitation confirmation slug" }), "acme");
    await user.type(screen.getByRole("textbox", { name: "Invitation revocation reason" }), "Sent in error");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(vi.mocked(revokePlatformOrganizationInvite)).toHaveBeenCalledWith({ organizationId: "org-1", inviteId: "invite-1", confirmationSlug: "acme", reason: "Sent in error" });
  });
});
