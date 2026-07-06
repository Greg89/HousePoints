import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const baseProps = {
  session: {
    userName: "Gregory Dodson",
    role: "ADMIN" as const,
    organizationContexts: [
      {
        organizationId: "org-1",
        organizationName: "Acme Corp",
        organizationSlug: "acme",
        role: "ADMIN" as const,
        houseId: "house-1",
        houseName: "Slytherin",
        houseColor: "#22c55e",
        isCurrent: true,
      },
    ],
  },
  logoutUrl: "/auth/logout",
};

describe("AccountMenu", () => {
  beforeEach(() => {
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("renders account identity and account links", async () => {
    const user = userEvent.setup();
    render(<AccountMenu {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const dialog = screen.getByRole("dialog", { name: /account/i });
    expect(dialog).toHaveTextContent("Gregory Dodson");
    expect(dialog).toHaveTextContent("Admin");
    expect(dialog).toHaveTextContent("Acme Corp");
    expect(within(dialog).getByRole("link", { name: /account settings/i })).toHaveAttribute("href", "/settings");
    expect(within(dialog).getByRole("link", { name: /manage organisations/i })).toHaveAttribute(
      "href",
      "/settings#organisations",
    );
    expect(within(dialog).getByRole("link", { name: /sign out/i })).toHaveAttribute("href", "/auth/logout");
    expect(within(dialog).queryByRole("link", { name: /what's new/i })).not.toBeInTheDocument();
  });

  it("shows a persistent What's New link when release notes are configured", async () => {
    const user = userEvent.setup();
    render(<AccountMenu {...baseProps} releaseNotesUrl="https://housepoints.example/releases/" />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("link", { name: /what's new/i })).toHaveAttribute(
      "href",
      "https://housepoints.example/releases/",
    );
  });
});
