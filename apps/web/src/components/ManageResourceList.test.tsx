import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ManageResourceList } from "./ManageResourceList";

describe("ManageResourceList", () => {
  it("groups a labelled collection under an optional header", () => {
    render(
      <ManageResourceList
        label="Members"
        header={<div><span>Member</span><span>Role</span></div>}
      >
        <button type="button">Manage Alice</button>
        <button type="button">Manage Ben</button>
      </ManageResourceList>,
    );

    const list = screen.getByRole("region", { name: "Members" });
    expect(list).toHaveTextContent("Member");
    expect(list).toHaveTextContent("Role");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("supports collections without a column header", () => {
    render(
      <ManageResourceList label="Season history">
        <article>Spring</article>
        <article>Winter</article>
      </ManageResourceList>,
    );

    expect(screen.getByRole("region", { name: "Season history" })).toHaveTextContent(
      "SpringWinter",
    );
  });
});
