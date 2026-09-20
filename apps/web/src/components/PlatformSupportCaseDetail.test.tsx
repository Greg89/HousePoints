import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addPlatformSupportNote, updatePlatformSupportCase } from "@/app/actions/platform";
import { PlatformSupportCaseDetail } from "./PlatformSupportCaseDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({ addPlatformSupportNote: vi.fn().mockResolvedValue({ ok: true }), updatePlatformSupportCase: vi.fn().mockResolvedValue({ ok: true }) }));

const supportCase = { id: "case-1", title: "Sign-in problem", summary: "Member reports an authentication loop.", status: "OPEN" as const, priority: "HIGH" as const, organization: null, user: null, noteCount: 0, notes: [], createdByAuth0Sub: "auth0|owner", resolvedAt: null, createdAt: "2026-09-20T12:00:00.000Z", updatedAt: "2026-09-20T12:00:00.000Z" };

describe("PlatformSupportCaseDetail", () => {
  it("updates lifecycle state and appends a private note", async () => {
    const user = userEvent.setup(); render(<PlatformSupportCaseDetail supportCase={supportCase} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Case status" }), "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Save case" }));
    expect(vi.mocked(updatePlatformSupportCase)).toHaveBeenCalledWith({ supportCaseId: "case-1", status: "IN_PROGRESS", priority: "HIGH" });
    await user.type(screen.getByRole("textbox", { name: "Private support note" }), "Asked the member to retry.");
    await user.click(screen.getByRole("button", { name: "Add private note" }));
    expect(vi.mocked(addPlatformSupportNote)).toHaveBeenCalledWith({ supportCaseId: "case-1", body: "Asked the member to retry." });
  });
});
