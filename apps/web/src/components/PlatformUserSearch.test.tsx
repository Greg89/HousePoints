import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { revokePlatformUserDevices, searchPlatformUsers } from "@/app/actions/platform";
import { PlatformUserSearch } from "./PlatformUserSearch";

vi.mock("@/app/actions/platform", () => ({ searchPlatformUsers: vi.fn(), revokePlatformUserDevices: vi.fn() }));

describe("PlatformUserSearch", () => {
  it("shows effective access and capabilities returned by the diagnostic endpoint", async () => {
    vi.mocked(revokePlatformUserDevices).mockResolvedValue({ ok: true, revokedCount: 1 });
    vi.mocked(searchPlatformUsers).mockResolvedValue({ ok: true, data: { users: [{ id: "user-1", displayName: "Alex Owner", email: "alex@example.com", auth0Sub: "auth0|alex", deletionRequestedAt: null, activeDeviceCount: 1, devices: [{ id: "device-1", organizationId: "org-1", organizationName: "Acme", platform: "ANDROID", appVersion: "1.2.3", locale: "en-US", createdAt: "2026-09-01T12:00:00.000Z", lastSeenAt: "2026-09-19T12:00:00.000Z" }], memberships: [{ organizationId: "org-1", organizationName: "Acme", organizationSlug: "acme", role: "OWNER", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE", effectiveAccess: "ALLOWED", capabilities: ["VIEW_ORGANIZATION", "AWARD_POINTS", "MANAGE_MEMBERS", "MANAGE_ORGANIZATION"] }] }] } });
    const user = userEvent.setup(); render(<PlatformUserSearch />);
    await user.type(screen.getByLabelText("Search users"), "alex"); await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("heading", { name: "Alex Owner" })).toBeInTheDocument();
    expect(screen.getByText("ALLOWED")).toBeInTheDocument();
    expect(screen.getByText(/MANAGE_ORGANIZATION/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Device confirmation for Alex Owner" }), "Alex Owner");
    await user.type(screen.getByRole("textbox", { name: "Device revocation reason for Alex Owner" }), "Lost device");
    await user.click(screen.getByRole("button", { name: "Revoke device" }));
    expect(vi.mocked(revokePlatformUserDevices)).toHaveBeenCalledWith({ userId: "user-1", deviceRegistrationId: "device-1", confirmationDisplayName: "Alex Owner", reason: "Lost device" });
  });
});
