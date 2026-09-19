import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { searchPlatformUsers } from "@/app/actions/platform";
import { PlatformUserSearch } from "./PlatformUserSearch";

vi.mock("@/app/actions/platform", () => ({ searchPlatformUsers: vi.fn() }));

describe("PlatformUserSearch", () => {
  it("shows effective access and capabilities returned by the diagnostic endpoint", async () => {
    vi.mocked(searchPlatformUsers).mockResolvedValue({ ok: true, data: { users: [{ id: "user-1", displayName: "Alex Owner", email: "alex@example.com", auth0Sub: "auth0|alex", deletionRequestedAt: null, activeDeviceCount: 1, memberships: [{ organizationId: "org-1", organizationName: "Acme", organizationSlug: "acme", role: "OWNER", membershipStatus: "ACTIVE", organizationStatus: "ACTIVE", effectiveAccess: "ALLOWED", capabilities: ["VIEW_ORGANIZATION", "AWARD_POINTS", "MANAGE_MEMBERS", "MANAGE_ORGANIZATION"] }] }] } });
    const user = userEvent.setup(); render(<PlatformUserSearch />);
    await user.type(screen.getByLabelText("Search users"), "alex"); await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Alex Owner")).toBeInTheDocument();
    expect(screen.getByText("ALLOWED")).toBeInTheDocument();
    expect(screen.getByText(/MANAGE_ORGANIZATION/)).toBeInTheDocument();
  });
});
