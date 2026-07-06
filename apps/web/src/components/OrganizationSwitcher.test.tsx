import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

const baseContexts = [
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
];

describe("OrganizationSwitcher", () => {
  it("shows current organization in the trigger", () => {
    render(<OrganizationSwitcher organizationContexts={baseContexts} />);

    expect(screen.getByRole("button", { name: /current organization: acme corp/i })).toBeInTheDocument();
  });

  it("shows organization switch links when user belongs to multiple organizations", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationSwitcher
        organizationContexts={[
          ...baseContexts,
          {
            organizationId: "org-2",
            organizationName: "Beta Org",
            organizationSlug: "beta",
            role: "OWNER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /current organization: acme corp/i }));

    const dialog = screen.getByRole("dialog", { name: /switch organization/i });
    expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(dialog).getByText("Current")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /beta org/i })).toHaveAttribute("href", "/o/beta/switch");
  });

  it("limits rows and links to the full organization list", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationSwitcher
        organizationContexts={[
          {
            ...baseContexts[0],
            isCurrent: false,
          },
          {
            organizationId: "org-2",
            organizationName: "Beta Org",
            organizationSlug: "beta",
            role: "OWNER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: true,
          },
          {
            organizationId: "org-3",
            organizationName: "Gamma Org",
            organizationSlug: "gamma",
            role: "MEMBER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
          {
            organizationId: "org-4",
            organizationName: "Delta Org",
            organizationSlug: "delta",
            role: "MEMBER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
          {
            organizationId: "org-5",
            organizationName: "Epsilon Org",
            organizationSlug: "epsilon",
            role: "MEMBER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
          {
            organizationId: "org-6",
            organizationName: "Zeta Org",
            organizationSlug: "zeta",
            role: "MEMBER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /current organization: beta org/i }));

    const dialog = screen.getByRole("dialog", { name: /switch organization/i });
    expect(within(dialog).getByText("Beta Org")).toBeInTheDocument();
    expect(within(dialog).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(dialog).queryByText("Zeta Org")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /view all organisations \(1 more\)/i })).toHaveAttribute(
      "href",
      "/settings#organisations",
    );
  });

  it("moves focus into the switcher on open and returns focus to trigger on escape", async () => {
    const user = userEvent.setup();
    render(
      <OrganizationSwitcher
        organizationContexts={[
          ...baseContexts,
          {
            organizationId: "org-2",
            organizationName: "Beta Org",
            organizationSlug: "beta",
            role: "OWNER",
            houseId: null,
            houseName: null,
            houseColor: null,
            isCurrent: false,
          },
        ]}
      />,
    );

    const trigger = screen.getByRole("button", { name: /current organization: acme corp/i });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /beta org/i })).toHaveFocus();
    });

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: /switch organization/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
