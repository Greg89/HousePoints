import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HouseThemeToggleForm } from "./HouseThemeToggleForm";

function setupToggle(overrides: Partial<React.ComponentProps<typeof HouseThemeToggleForm>> = {}) {
  const props = {
    enabled: false,
    houseName: "Phoenix",
    houseColor: "#7c3aed",
    onSave: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };

  render(<HouseThemeToggleForm {...props} />);

  return {
    props,
    user: userEvent.setup(),
  };
}

describe("HouseThemeToggleForm", () => {
  it("saves the next preference when toggled", async () => {
    const { props, user } = setupToggle();

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(true));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("House theme preference saved.")).toBeInTheDocument();
  });

  it("disables the toggle when the user is not assigned to a house", async () => {
    const { props, user } = setupToggle({ houseName: null, houseColor: null });

    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText(/A house assignment is required/i)).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));

    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("disables the toggle when the assigned house color cannot generate a theme", async () => {
    const { props, user } = setupToggle({ houseColor: "purple" });

    expect(screen.getByRole("switch")).toBeDisabled();
    expect(screen.getByText(/valid six-digit hex color/i)).toBeInTheDocument();

    await user.click(screen.getByRole("switch"));

    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("rolls back the optimistic toggle when saving fails", async () => {
    const { props, user } = setupToggle({
      onSave: vi.fn().mockResolvedValue({
        ok: false,
        code: "HOUSE_THEME_REJECTED",
        message: "House theme could not be updated.",
      }),
    });

    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(true));
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("House theme could not be updated.")).toBeInTheDocument();
  });
});
