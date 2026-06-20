import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DisplayNameForm } from "./DisplayNameForm";

vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
    }) => {
      void whileHover;
      void whileTap;
      return <button {...props}>{children}</button>;
    },
  },
}));

function setupForm(overrides: Partial<React.ComponentProps<typeof DisplayNameForm>> = {}) {
  const props = {
    currentName: "Current User",
    onSave: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };

  render(<DisplayNameForm {...props} />);

  return {
    props,
    user: userEvent.setup(),
  };
}

describe("DisplayNameForm", () => {
  it("shows a success message when the typed result succeeds", async () => {
    const { props, user } = setupForm();

    await user.clear(screen.getByLabelText("Display Name"));
    await user.type(screen.getByLabelText("Display Name"), "Updated User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith("Updated User"));
    expect(screen.getByText("Display name updated successfully.")).toBeInTheDocument();
  });

  it("shows a safe error message when the typed result fails", async () => {
    const { props, user } = setupForm({
      onSave: vi.fn().mockResolvedValue({
        ok: false,
        code: "DISPLAY_NAME_REJECTED",
        message: "Your display name could not be updated. Please try again.",
      }),
    });

    await user.clear(screen.getByLabelText("Display Name"));
    await user.type(screen.getByLabelText("Display Name"), "Updated User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledOnce());
    expect(screen.getByText("Your display name could not be updated. Please try again.")).toBeInTheDocument();
  });

  it("keeps the unexpected error fallback for thrown failures", async () => {
    const { props, user } = setupForm({
      onSave: vi.fn().mockRejectedValue(new Error("network vanished")),
    });

    await user.clear(screen.getByLabelText("Display Name"));
    await user.type(screen.getByLabelText("Display Name"), "Updated User");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledOnce());
    expect(screen.getByText("network vanished")).toBeInTheDocument();
  });
});
