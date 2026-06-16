import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminForms } from "./AdminForms";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const users = [
  { id: "user-1", displayName: "Alice Assigned", houseId: "house-1" },
  { id: "user-2", displayName: "Ben Unassigned", houseId: null },
];

const houses = [
  { id: "house-1", name: "Slytherin", color: "#22c55e" },
  { id: "house-2", name: "Ravenclaw", color: "#1d4ed8" },
];

function setupAdminForms(overrides: Partial<React.ComponentProps<typeof AdminForms>> = {}) {
  const props = {
    users,
    houses,
    onCreateHouse: vi.fn().mockResolvedValue(undefined),
    onAssignHouse: vi.fn().mockResolvedValue(undefined),
    onCreateInvite: vi.fn().mockResolvedValue({
      token: "invite-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    ...overrides,
  };

  render(<AdminForms {...props} />);

  return {
    user: userEvent.setup(),
    props,
  };
}

describe("AdminForms", () => {
  it("uses compact, labelled color controls for house forms", () => {
    setupAdminForms();

    expect(screen.getByLabelText(/House color/)).toHaveAttribute("type", "color");
    expect(screen.getByLabelText(/New color/)).toHaveAttribute("type", "color");
    expect(screen.getAllByText("Choose a house accent color")).toHaveLength(2);
  });

  it("submits create-house data without changing the action contract", async () => {
    const { user, props } = setupAdminForms();
    const createHouseForm = within(screen.getByRole("form", { name: "Create house" }));

    await user.type(createHouseForm.getByPlaceholderText("House name"), "Hufflepuff");
    fireEvent.change(createHouseForm.getByLabelText(/House color/), {
      target: { value: "#facc15" },
    });
    await user.type(createHouseForm.getByPlaceholderText("Description (optional)"), "Hard workers");
    await user.click(createHouseForm.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());

    const createHouseMock = props.onCreateHouse as ReturnType<typeof vi.fn>;
    const formData = createHouseMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      name: "Hufflepuff",
      color: "#facc15",
      description: "Hard workers",
    });
  });

  it("sets the edit color to the selected house color", async () => {
    const { user } = setupAdminForms();
    const editHouseForm = within(screen.getByRole("form", { name: "Edit house" }));
    const colorInput = editHouseForm.getByLabelText(/New color/) as HTMLInputElement;

    expect(colorInput.value).toBe("#7c3aed");

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Ravenclaw");
    expect(colorInput.value).toBe("#1d4ed8");

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Slytherin");
    expect(colorInput.value).toBe("#22c55e");
  });

  it("submits assignment data from the team setup card", async () => {
    const { user, props } = setupAdminForms();
    const assignForm = within(screen.getByRole("form", { name: "Assign user to house" }));

    await user.selectOptions(assignForm.getByLabelText("Member to assign"), "user-2");
    await user.selectOptions(assignForm.getByLabelText("House assignment"), "house-2");
    await user.click(assignForm.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(props.onAssignHouse).toHaveBeenCalledOnce());

    const assignHouseMock = props.onAssignHouse as ReturnType<typeof vi.fn>;
    const formData = assignHouseMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
      targetHouseId: "house-2",
    });
  });

  it("keeps unassigned members visible first in the assignment dropdown", () => {
    setupAdminForms();
    const assignForm = within(screen.getByRole("form", { name: "Assign user to house" }));
    const memberSelect = assignForm.getByLabelText("Member to assign") as HTMLSelectElement;
    const groups = Array.from(memberSelect.querySelectorAll("optgroup"));
    const options = Array.from(memberSelect.options).map((option) => option.textContent);

    expect(groups.map((group) => group.label)).toEqual([
      "Needs assignment (1)",
      "Assigned members",
    ]);
    expect(options).toEqual([
      "Select member... 1 needs assignment",
      "Ben Unassigned - Needs assignment",
      "Alice Assigned",
    ]);
    expect(assignForm.getByText("1 member needs a house. They appear first in this list.")).toBeInTheDocument();
  });

  it("shows generated invite tokens in the invite card", async () => {
    const { user, props } = setupAdminForms();

    const inviteCard = screen.getByText("Invite Member").closest("div");
    expect(inviteCard).not.toBeNull();

    await user.click(
      within(inviteCard!).getByRole("button", { name: "Generate invite token" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(within(inviteCard!).getByText("invite-token")).toBeInTheDocument();
    expect(within(inviteCard!).getByTitle("Copy token")).toBeInTheDocument();
  });
});
