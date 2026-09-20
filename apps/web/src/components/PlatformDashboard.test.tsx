import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlatformOverview } from "@housepoints/contracts";
import { PlatformDashboard } from "./PlatformDashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({
  updatePlatformSettings: vi.fn().mockResolvedValue({ ok: true }),
}));

const overview: PlatformOverview = {
  activeOrganizationCount: 1,
  archivedOrganizationCount: 1,
  totalMemberCount: 12,
  settings: {
    organizationCreationEnabled: true,
    maxActiveOrganizations: 10,
    hardOrganizationCreationEnabled: true,
    hardMaxActiveOrganizations: 10,
    effectiveOrganizationCreationEnabled: true,
    effectiveMaxActiveOrganizations: 10,
  },
  organizations: [
    { id: "org-1", name: "Acme Corp", slug: "acme", status: "ACTIVE", memberCount: 10, ownerCount: 1, lastActivityAt: null, createdAt: "2026-09-01T12:00:00.000Z" },
    { id: "org-2", name: "Demo Team", slug: "demo", status: "ARCHIVED", memberCount: 2, ownerCount: 1, lastActivityAt: null, createdAt: "2026-09-02T12:00:00.000Z" },
  ],
  recentAuditEvents: [],
};

describe("PlatformDashboard", () => {
  it("shows capacity metrics and filters organizations", async () => {
    const user = userEvent.setup();
    render(<PlatformDashboard overview={overview} />);

    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Demo Team")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Search organizations" }), "demo");

    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.getByText("Demo Team")).toBeInTheDocument();
  });
});
