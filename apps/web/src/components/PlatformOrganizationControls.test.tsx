import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { updatePlatformOrganizationStatus } from "@/app/actions/platform";
import { PlatformOrganizationControls } from "./PlatformOrganizationControls";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({ updatePlatformOrganizationStatus: vi.fn().mockResolvedValue({ ok: true }) }));

const organization = { id: "org-1", name: "Acme", slug: "acme", status: "ACTIVE" as const, memberCount: 3, ownerCount: 1, lastActivityAt: null, createdAt: "2026-09-01T12:00:00.000Z", archivedAt: null, suspendedAt: null, suspensionReason: null, transactionCount: 5, activeInviteCount: 1, deviceCount: 2 };

describe("PlatformOrganizationControls", () => {
  it("requires the exact slug and a reason before suspending", async () => {
    const user = userEvent.setup(); render(<PlatformOrganizationControls organization={organization} />);
    const button = screen.getByRole("button", { name: "Suspend organization" });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Confirmation slug" }), "acme");
    await user.type(screen.getByRole("textbox", { name: "Suspension reason" }), "Policy review");
    expect(button).toBeEnabled(); await user.click(button);
    expect(vi.mocked(updatePlatformOrganizationStatus)).toHaveBeenCalledWith({ organizationId: "org-1", action: "SUSPEND", confirmationSlug: "acme", reason: "Policy review" });
  });
});
