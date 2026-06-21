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

const activeSeason = {
  id: "season-active",
  name: "Q3 2026",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: null,
  isActive: true,
};

const historicalSeason = {
  id: "season-0",
  name: "Season 0",
  startsAt: "2026-06-01T00:00:00.000Z",
  endsAt: "2026-07-01T00:00:00.000Z",
  isActive: false,
};

function setupAdminForms(overrides: Partial<React.ComponentProps<typeof AdminForms>> = {}) {
  const props = {
    users,
    houses,
    seasons: [activeSeason, historicalSeason],
    activeSeason,
    actorRole: "OWNER" as const,
    onCreateHouse: vi.fn().mockResolvedValue({ ok: true }),
    onAssignHouse: vi.fn().mockResolvedValue({ ok: true }),
    onCreateInvite: vi.fn().mockResolvedValue({
      ok: true,
      token: "invite-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }),
    onStartSeason: vi.fn().mockResolvedValue({
      ok: true,
      transition: {
        previousSeason: { ...activeSeason, endsAt: "2026-08-01T00:00:00.000Z", isActive: false },
        activeSeason: {
          id: "season-next",
          name: "Q4 2026",
          startsAt: "2026-08-01T00:00:00.000Z",
          endsAt: null,
          isActive: true,
        },
      },
    }),
    onRenameSeason: vi.fn().mockResolvedValue({
      ok: true,
      season: {
        ...activeSeason,
        name: "Summer Sprint",
      },
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
  it("shows season management controls with the current active season", () => {
    setupAdminForms();

    expect(screen.getByRole("form", { name: "Start season" })).toHaveTextContent(
      "Current active season: Q3 2026",
    );
    expect(screen.getByRole("form", { name: "Rename season" })).toBeInTheDocument();
  });

  it("confirms and starts a new season for owners", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms();
    const startSeasonForm = within(screen.getByRole("form", { name: "Start season" }));

    await user.type(startSeasonForm.getByPlaceholderText("New season name"), "Q4 2026");
    await user.click(startSeasonForm.getByRole("button", { name: "Start season" }));

    await waitFor(() => expect(props.onStartSeason).toHaveBeenCalledOnce());
    expect(confirmSpy).toHaveBeenCalledWith(
      'Start "Q4 2026" now? This will close Q3 2026 and reset current-season scoring.',
    );

    const startSeasonMock = props.onStartSeason as ReturnType<typeof vi.fn>;
    const formData = startSeasonMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({ name: "Q4 2026" });
    await screen.findByText(/Current active season:/);
    expect(startSeasonForm.getByText("Q4 2026")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("confirms and starts a new season for admins", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms({ actorRole: "ADMIN" });
    const startSeasonForm = within(screen.getByRole("form", { name: "Start season" }));

    await user.type(startSeasonForm.getByPlaceholderText("New season name"), "Q4 2026");
    await user.click(startSeasonForm.getByRole("button", { name: "Start season" }));

    await waitFor(() => expect(props.onStartSeason).toHaveBeenCalledOnce());
    expect(confirmSpy).toHaveBeenCalledWith(
      'Start "Q4 2026" now? This will close Q3 2026 and reset current-season scoring.',
    );
    confirmSpy.mockRestore();
  });

  it("shows a safe toast when start-season returns an expected failure", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms({
      onStartSeason: vi.fn().mockResolvedValue({
        ok: false,
        code: "ACTIVE_SEASON_NOT_FOUND",
        message: "The season could not be started. Please try again.",
      }),
    });
    const startSeasonForm = within(screen.getByRole("form", { name: "Start season" }));

    await user.type(startSeasonForm.getByPlaceholderText("New season name"), "Q4 2026");
    await user.click(startSeasonForm.getByRole("button", { name: "Start season" }));

    await waitFor(() => expect(props.onStartSeason).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to start season", {
      description: "The season could not be started. Please try again.",
    });
    expect(startSeasonForm.getByText("Q3 2026")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("submits rename-season data", async () => {
    const { user, props } = setupAdminForms();
    const renameSeasonForm = within(screen.getByRole("form", { name: "Rename season" }));

    await user.selectOptions(renameSeasonForm.getByLabelText("Season to rename"), "season-0");
    await user.type(renameSeasonForm.getByPlaceholderText("Updated season name"), "Launch Season");
    await user.click(renameSeasonForm.getByRole("button", { name: "Rename season" }));

    await waitFor(() => expect(props.onRenameSeason).toHaveBeenCalledOnce());
    const renameSeasonMock = props.onRenameSeason as ReturnType<typeof vi.fn>;
    const formData = renameSeasonMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      seasonId: "season-0",
      name: "Launch Season",
    });
  });

  it("shows a safe toast when rename-season returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onRenameSeason: vi.fn().mockResolvedValue({
        ok: false,
        code: "SEASON_NOT_FOUND",
        message: "The season could not be renamed. Please try again.",
      }),
    });
    const renameSeasonForm = within(screen.getByRole("form", { name: "Rename season" }));

    await user.selectOptions(renameSeasonForm.getByLabelText("Season to rename"), "season-0");
    await user.type(renameSeasonForm.getByPlaceholderText("Updated season name"), "Launch Season");
    await user.click(renameSeasonForm.getByRole("button", { name: "Rename season" }));

    await waitFor(() => expect(props.onRenameSeason).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to rename season", {
      description: "The season could not be renamed. Please try again.",
    });
  });

  it("uses compact, labelled color controls for house forms", () => {
    setupAdminForms();

    expect(screen.getByLabelText(/House color/)).toHaveAttribute("type", "color");
    expect(screen.getByLabelText(/New color/)).toHaveAttribute("type", "color");
    expect(screen.getAllByText("Choose a house accent color")).toHaveLength(2);
  });

  it("submits create-house data and shows success when the typed result succeeds", async () => {
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
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("House created", {
      description: "Hufflepuff",
    });
  });

  it("shows a safe toast when create-house returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateHouse: vi.fn().mockResolvedValue({
        ok: false,
        code: "HOUSE_ALREADY_EXISTS",
        message: "The house could not be created. Please try again.",
      }),
    });
    const createHouseForm = within(screen.getByRole("form", { name: "Create house" }));

    await user.type(createHouseForm.getByPlaceholderText("House name"), "Hufflepuff");
    await user.click(createHouseForm.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to create house", {
      description: "The house could not be created. Please try again.",
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

  it("shows a safe toast when edit-house returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateHouse: vi.fn().mockResolvedValue({
        ok: false,
        code: "HOUSE_ALREADY_EXISTS",
        message: "The house could not be created. Please try again.",
      }),
    });
    const editHouseForm = within(screen.getByRole("form", { name: "Edit house" }));

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Ravenclaw");
    await user.click(editHouseForm.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update house", {
      description: "The house could not be created. Please try again.",
    });
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
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("House assigned", {
      description: "Ben Unassigned -> Ravenclaw",
    });
  });

  it("shows a safe toast when assignment returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onAssignHouse: vi.fn().mockResolvedValue({
        ok: false,
        code: "USER_NOT_FOUND",
        message: "The user could not be assigned to that house. Please try again.",
      }),
    });
    const assignForm = within(screen.getByRole("form", { name: "Assign user to house" }));

    await user.selectOptions(assignForm.getByLabelText("Member to assign"), "user-2");
    await user.selectOptions(assignForm.getByLabelText("House assignment"), "house-2");
    await user.click(assignForm.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(props.onAssignHouse).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to assign house", {
      description: "The user could not be assigned to that house. Please try again.",
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

  it("shows a safe toast when invite generation returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateInvite: vi.fn().mockResolvedValue({
        ok: false,
        code: "INVITE_LIMIT_REACHED",
        message: "An invite could not be generated. Please try again.",
      }),
    });

    const inviteCard = screen.getByText("Invite Member").closest("div");
    expect(inviteCard).not.toBeNull();

    await user.click(
      within(inviteCard!).getByRole("button", { name: "Generate invite token" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(screen.queryByText("invite-token")).not.toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to generate invite", {
      description: "An invite could not be generated. Please try again.",
    });
  });
});
