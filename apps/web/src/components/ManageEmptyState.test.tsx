import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManageEmptyState } from "./ManageEmptyState";

describe("ManageEmptyState", () => {
  it("renders a labelled state with optional icon and recovery action", () => {
    render(
      <ManageEmptyState
        title="No houses yet"
        description="Create the first house before assigning members."
        icon={<span>House icon</span>}
        action={<button type="button">Create the first house</button>}
      />,
    );

    const state = screen.getByRole("region", { name: "No houses yet" });
    expect(state).toHaveTextContent("Create the first house before assigning members.");
    expect(screen.getByRole("button", { name: "Create the first house" })).toBeInTheDocument();
    expect(state.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
