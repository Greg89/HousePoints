import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManageToolbar } from "./ManageToolbar";

describe("ManageToolbar", () => {
  it("groups primary and secondary controls with status and an inline error", () => {
    render(
      <ManageToolbar
        label="Member controls"
        secondary={<input aria-label="Search members" />}
        status="2 members shown"
        error="Members could not be loaded."
      >
        <button type="button">All</button>
        <button type="button">Unassigned</button>
      </ManageToolbar>,
    );

    const toolbar = screen.getByRole("region", { name: "Member controls" });
    expect(toolbar).toContainElement(screen.getByRole("button", { name: "All" }));
    expect(toolbar).toContainElement(screen.getByLabelText("Search members"));
    expect(toolbar).toHaveTextContent("2 members shown");
    expect(toolbar).toHaveTextContent("Members could not be loaded.");
  });
});
