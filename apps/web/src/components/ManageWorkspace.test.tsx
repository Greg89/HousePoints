import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManageWorkspace } from "./ManageWorkspace";

describe("ManageWorkspace", () => {
  it("provides a consistent labelled workspace header, count, and action slot", () => {
    render(
      <ManageWorkspace
        id="members"
        title="Members"
        description="Manage organization members."
        count={12}
        action={<button type="button">Invite member</button>}
      >
        <p>Member list</p>
      </ManageWorkspace>,
    );

    const workspace = screen.getByRole("region", { name: "Members" });
    expect(screen.getByRole("heading", { name: "Members", level: 2 })).toBeInTheDocument();
    expect(workspace).toHaveTextContent("Manage organization members.");
    expect(workspace).toHaveTextContent("12");
    expect(screen.getByRole("button", { name: "Invite member" })).toBeInTheDocument();
    expect(workspace).toHaveTextContent("Member list");
  });

  it("supports an explicit accessible label without duplicating the visible title", () => {
    render(
      <ManageWorkspace
        id="overview"
        title="Organization overview"
        description="Review organization health."
        ariaLabel="Manage overview"
      >
        <p>Healthy</p>
      </ManageWorkspace>,
    );

    expect(screen.getByRole("region", { name: "Manage overview" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Organization overview", level: 2 }),
    ).toBeInTheDocument();
  });
});
