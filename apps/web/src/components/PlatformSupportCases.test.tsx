import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createPlatformSupportCase } from "@/app/actions/platform";
import { PlatformSupportCases } from "./PlatformSupportCases";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/actions/platform", () => ({ createPlatformSupportCase: vi.fn().mockResolvedValue({ ok: true, id: "case-1" }) }));

describe("PlatformSupportCases", () => {
  it("creates an optionally linked private support case", async () => {
    const user = userEvent.setup(); render(<PlatformSupportCases data={{ cases: [] }} />);
    await user.type(screen.getByRole("textbox", { name: "Case title" }), "Sign-in problem");
    await user.type(screen.getByRole("textbox", { name: "Case summary" }), "Member reports an authentication loop.");
    await user.selectOptions(screen.getByRole("combobox", { name: "Case priority" }), "HIGH");
    await user.type(screen.getByRole("textbox", { name: "Case organization ID" }), "org-1");
    await user.type(screen.getByRole("textbox", { name: "Case user ID" }), "user-1");
    await user.click(screen.getByRole("button", { name: "Create support case" }));
    expect(vi.mocked(createPlatformSupportCase)).toHaveBeenCalledWith({ title: "Sign-in problem", summary: "Member reports an authentication loop.", priority: "HIGH", organizationId: "org-1", userId: "user-1" });
    expect(push).toHaveBeenCalledWith("/platform/support-cases/case-1");
  });
});
