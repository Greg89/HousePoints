import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ManageDetailSheet } from "./ManageDetailSheet";

function DetailSheetHarness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Edit resource
      </button>
      <ManageDetailSheet
        open={open}
        onOpenChange={setOpen}
        title="Edit house"
        description="Update this house."
        closeLabel="Close editor"
      >
        <label>
          House name
          <input />
        </label>
      </ManageDetailSheet>
    </>
  );
}

describe("ManageDetailSheet", () => {
  it("provides an accessible modal sheet and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<DetailSheetHarness />);
    const trigger = screen.getByRole("button", { name: "Edit resource" });

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Edit house" });
    expect(dialog).toHaveAccessibleDescription("Update this house.");
    expect(screen.getByRole("button", { name: "Close editor" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Edit house" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
