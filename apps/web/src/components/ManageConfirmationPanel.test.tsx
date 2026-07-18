import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ManageConfirmationPanel } from "./ManageConfirmationPanel";

describe("ManageConfirmationPanel", () => {
  it("exposes the warning and invokes either decision", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ManageConfirmationPanel
        title="Start Spring now?"
        description="This closes Winter and resets current-season scoring."
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmLabel="Start season"
      />,
    );

    expect(screen.getByRole("region", { name: "Confirmation required" })).toHaveTextContent(
      "This closes Winter",
    );
    await user.click(screen.getByRole("button", { name: "Start season" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables both decisions and announces pending work", () => {
    render(
      <ManageConfirmationPanel
        title="Transfer ownership?"
        description="Your role will change."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        pending
        pendingLabel="Transferring..."
        tone="destructive"
      />,
    );

    expect(screen.getByRole("button", { name: "Transferring..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
