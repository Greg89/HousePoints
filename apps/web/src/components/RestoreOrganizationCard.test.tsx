import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { RestoreOrganizationCard } from "./RestoreOrganizationCard";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("RestoreOrganizationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires the exact slug before restoring and opens the restored dashboard", async () => {
    const onRestoreOrganization = vi.fn().mockResolvedValue({
      ok: true,
      redirectTo: "/o/acme/switch",
    });
    render(
      <RestoreOrganizationCard
        organizationName="Acme Corp"
        organizationSlug="acme"
        onRestoreOrganization={onRestoreOrganization}
      />,
    );

    const button = screen.getByRole("button", { name: "Restore organization" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Organization slug"), {
      target: { value: "acme" },
    });
    fireEvent.click(button);

    await waitFor(() => expect(onRestoreOrganization).toHaveBeenCalledOnce());
    const submitted = onRestoreOrganization.mock.calls[0][0] as FormData;
    expect(submitted.get("slug")).toBe("acme");
    expect(submitted.get("confirmation")).toBe("acme");
    expect(toast.success).toHaveBeenCalledWith("Organization restored", {
      description: "Opening the restored dashboard.",
    });
    expect(replaceMock).toHaveBeenCalledWith("/o/acme/switch");
  });

  it("keeps the user on the archived page when the restore API rejects the request", async () => {
    const onRestoreOrganization = vi.fn().mockResolvedValue({
      ok: false,
      code: "OWNER_REQUIRED",
      message: "Owner access to the archived organization is required",
    });
    render(
      <RestoreOrganizationCard
        organizationName="Acme Corp"
        organizationSlug="acme"
        onRestoreOrganization={onRestoreOrganization}
      />,
    );

    fireEvent.change(screen.getByLabelText("Organization slug"), {
      target: { value: "acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore organization" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to restore organization", {
        description: "Owner access to the archived organization is required",
      });
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
