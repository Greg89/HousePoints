import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { completePlatformAccountDeletion } from "@/app/actions/platform";
import { PlatformAccountDeletionQueue } from "./PlatformAccountDeletionQueue";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({ completePlatformAccountDeletion: vi.fn().mockResolvedValue({ ok: true }) }));

describe("PlatformAccountDeletionQueue", () => {
  it("requires exact confirmation and a substantive note before completion", async () => {
    const user = userEvent.setup();
    render(<PlatformAccountDeletionQueue queue={{ pending: [{ userId: "user-1", displayName: "Alex Owner", email: "alex@example.com", requestedAt: "2026-09-18T12:00:00.000Z", completedAt: null, completedByAuth0Sub: null, completionNote: null, evidence: null, membershipCount: 1, lastOwnerConflicts: [] }], recentlyCompleted: [] }} />);
    const button = screen.getByRole("button", { name: "Complete deletion" });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Deletion confirmation for Alex Owner" }), "Alex Owner");
    await user.type(screen.getByRole("textbox", { name: "Deletion note for Alex Owner" }), "Verified request and identity");
    expect(button).toBeEnabled();
    await user.click(button);
    expect(vi.mocked(completePlatformAccountDeletion)).toHaveBeenCalledWith({ userId: "user-1", confirmationDisplayName: "Alex Owner", completionNote: "Verified request and identity" });
  });

  it("blocks completion when an organization still needs another owner", () => {
    render(<PlatformAccountDeletionQueue queue={{ pending: [{ userId: "user-1", displayName: "Alex Owner", email: null, requestedAt: "2026-09-18T12:00:00.000Z", completedAt: null, completedByAuth0Sub: null, completionNote: null, evidence: null, membershipCount: 1, lastOwnerConflicts: [{ organizationId: "org-1", organizationName: "Acme" }] }], recentlyCompleted: [] }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Acme");
    expect(screen.getByRole("button", { name: "Complete deletion" })).toBeDisabled();
  });
});
