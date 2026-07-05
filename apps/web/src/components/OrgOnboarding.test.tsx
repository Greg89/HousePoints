import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createOrg, joinOrg } from "@/app/actions/orgs";
import { OrgOnboarding } from "./OrgOnboarding";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/app/actions/orgs", () => ({
  createOrg: vi.fn(),
  joinOrg: vi.fn(),
}));

const createOrgMock = vi.mocked(createOrg);
const joinOrgMock = vi.mocked(joinOrg);
const toastMock = vi.mocked(toast);

function setupOnboarding() {
  render(<OrgOnboarding userName="User One" />);
  return userEvent.setup();
}

describe("OrgOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createOrgMock.mockResolvedValue({ ok: true, redirectTo: "/o/acme/switch" });
    joinOrgMock.mockResolvedValue({ ok: true });
  });

  it("creates an organisation and shows success when the typed result succeeds", async () => {
    const user = setupOnboarding();

    await user.click(screen.getByRole("button", { name: /Create a new organisation/ }));
    await user.type(screen.getByPlaceholderText("Acme Corp"), "Acme Corp");
    await user.type(screen.getByPlaceholderText("Phoenix"), "Phoenix");
    await user.click(screen.getByRole("button", { name: "Create organisation" }));

    await waitFor(() =>
      expect(createOrgMock).toHaveBeenCalledWith(
        "Acme Corp",
        "acme-corp",
        "Phoenix",
        "#7c3aed",
      ),
    );
    expect(toastMock.success).toHaveBeenCalledWith("Organisation created!", {
      description: "Welcome to Acme Corp",
    });
    expect(pushMock).toHaveBeenCalledWith("/o/acme/switch");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("can start directly on the create view for existing members", async () => {
    const user = userEvent.setup();
    render(
      <OrgOnboarding
        userName="User One"
        initialView="create"
        allowJoin={false}
        backHref="/o/acme"
        introText="Create another organization."
      />,
    );

    expect(screen.queryByRole("button", { name: /join with an invite link/i })).not.toBeInTheDocument();
    expect(screen.getByText("Create another organization.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(pushMock).toHaveBeenCalledWith("/o/acme");
  });

  it("shows a safe create error when the typed result fails", async () => {
    createOrgMock.mockResolvedValue({
      ok: false,
      code: "ORG_SLUG_TAKEN",
      message: "The organisation could not be created. Please try again.",
    });
    const user = setupOnboarding();

    await user.click(screen.getByRole("button", { name: /Create a new organisation/ }));
    await user.type(screen.getByPlaceholderText("Acme Corp"), "Acme Corp");
    await user.type(screen.getByPlaceholderText("Phoenix"), "Phoenix");
    await user.click(screen.getByRole("button", { name: "Create organisation" }));

    await waitFor(() => expect(createOrgMock).toHaveBeenCalledOnce());
    expect(toastMock.error).toHaveBeenCalledWith("Could not create organisation", {
      description: "The organisation could not be created. Please try again.",
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("joins an organisation and shows success when the typed result succeeds", async () => {
    const user = setupOnboarding();

    await user.click(screen.getByRole("button", { name: /Join with an invite link/ }));
    await user.type(screen.getByPlaceholderText(/Paste your invite token here/), "invite-token");
    await user.click(screen.getByRole("button", { name: "Join organisation" }));

    await waitFor(() => expect(joinOrgMock).toHaveBeenCalledWith("invite-token"));
    expect(toastMock.success).toHaveBeenCalledWith("You've joined the organisation!");
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("shows a safe join error when the typed result fails", async () => {
    joinOrgMock.mockResolvedValue({
      ok: false,
      code: "INVITE_NOT_FOUND",
      message: "The invite could not be joined. Please try again.",
    });
    const user = setupOnboarding();

    await user.click(screen.getByRole("button", { name: /Join with an invite link/ }));
    await user.type(screen.getByPlaceholderText(/Paste your invite token here/), "invite-token");
    await user.click(screen.getByRole("button", { name: "Join organisation" }));

    await waitFor(() => expect(joinOrgMock).toHaveBeenCalledOnce());
    expect(toastMock.error).toHaveBeenCalledWith("Could not join organisation", {
      description: "The invite could not be joined. Please try again.",
    });
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
