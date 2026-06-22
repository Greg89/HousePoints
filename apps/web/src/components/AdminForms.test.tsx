import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminAuditAction } from "@housepoints/contracts";
import { describe, expect, it, vi } from "vitest";
import { AdminForms } from "./AdminForms";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const users = [
  { id: "user-1", displayName: "Alice Assigned", email: "alice@example.com", role: "ADMIN" as const, houseId: "house-1" },
  { id: "user-2", displayName: "Ben Unassigned", email: "ben@example.com", role: "MEMBER" as const, houseId: null },
];

const houses = [
  { id: "house-1", name: "Slytherin", color: "#22c55e", description: "Ambitious builders" },
  { id: "house-2", name: "Ravenclaw", color: "#1d4ed8", description: "Curious problem solvers" },
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

const recentDeletedPoints = [
  {
    id: "tx-1",
    actorName: "Olivia",
    targetUserName: "Ben Unassigned",
    targetHouseName: "Ravenclaw",
    targetHouseColor: "#1d4ed8",
    delta: 12,
    reason: "Duplicate award",
    trait: "COLLABORATION" as const,
    createdAt: "2026-06-20T12:00:00.000Z",
    deletedAt: "2026-06-21T12:00:00.000Z",
    deletedByName: "Alice Admin",
    deletionReason: "Entered twice",
    season: {
      id: "season-active",
      name: "Q3 2026",
      isActive: true,
    },
  },
];

const recentAdminActions: AdminAuditAction[] = [
  {
    id: "audit-event:point-delete-1",
    type: "POINT_DELETED",
    occurredAt: "2026-06-21T13:45:00.000Z",
    actorName: "Alice Admin",
    summary: "Alice Admin deleted 12 points from Ben Unassigned.",
    metadata: {
      transactionId: "tx-1",
      targetUserName: "Ben Unassigned",
      delta: "12",
      deletionReason: "Entered twice",
    },
  },
  {
    id: "audit-event:audit-1",
    type: "USER_HOUSE_ASSIGNED",
    occurredAt: "2026-06-21T13:30:00.000Z",
    actorName: "Alice Admin",
    summary: "Alice Admin assigned Ben Unassigned to Ravenclaw.",
    metadata: {
      targetUserId: "user-2",
      targetUserName: "Ben Unassigned",
      targetHouseId: "house-2",
      targetHouseName: "Ravenclaw",
    },
  },
  {
    id: "invite-created:invite-1",
    type: "INVITE_CREATED" as const,
    occurredAt: "2026-06-21T13:00:00.000Z",
    actorName: "Alice Admin",
    summary: "Alice Admin created an invite link.",
    metadata: {
      inviteId: "invite-1",
      expiresAt: "2026-06-24T13:00:00.000Z",
    },
  },
  {
    id: "invite-used:invite-1",
    type: "INVITE_USED" as const,
    occurredAt: "2026-06-21T13:15:00.000Z",
    actorName: "Ben Unassigned",
    summary: "Ben Unassigned joined with an invite link.",
    metadata: {
      inviteId: "invite-1",
      usedByName: "Ben Unassigned",
    },
  },
  {
    id: "season-started:season-next",
    type: "SEASON_STARTED" as const,
    occurredAt: "2026-06-21T12:30:00.000Z",
    actorName: "Alice Admin",
    summary: "Alice Admin started Q4 2026.",
    metadata: {
      seasonId: "season-next",
      seasonName: "Q4 2026",
    },
  },
];

function setupAdminForms(overrides: Partial<React.ComponentProps<typeof AdminForms>> = {}) {
  const props = {
    users,
    houses,
    seasons: [activeSeason, historicalSeason],
    activeSeason,
    actorRole: "OWNER" as const,
    recentDeletedPoints,
    recentAdminActions,
    adminAuditNextCursor: null,
    onCreateHouse: vi.fn().mockResolvedValue({ ok: true }),
    onAssignHouse: vi.fn().mockResolvedValue({ ok: true }),
    onPromoteUser: vi.fn().mockResolvedValue({ ok: true }),
    onLoadAdminAudit: vi.fn().mockResolvedValue({
      items: recentAdminActions,
      nextCursor: null,
    }),
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

function switchToManageSection(sectionName: string) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(sectionName) }));
}

describe("AdminForms", () => {
  it("defaults to the Manage overview and exposes focused section navigation", () => {
    setupAdminForms();

    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Team/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Manage your team")).toBeInTheDocument();

    switchToManageSection("Audit");

    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Audit/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Audit history")).toBeInTheDocument();
    expect(screen.queryByText("Recently deleted point awards")).not.toBeInTheDocument();
  });

  it("shows owner-only manage sections to admins without making them clickable", async () => {
    const { user } = setupAdminForms({ actorRole: "ADMIN" });

    const housesTab = screen.getByRole("tab", { name: /Houses/ });
    const seasonsTab = screen.getByRole("tab", { name: /Seasons/ });

    expect(housesTab).toBeVisible();
    expect(seasonsTab).toBeVisible();
    expect(housesTab).toBeDisabled();
    expect(seasonsTab).toBeDisabled();
    expect(housesTab).toHaveAttribute("aria-disabled", "true");
    expect(seasonsTab).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Owner only")).toHaveLength(2);

    await user.click(housesTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Create house" })).not.toBeInTheDocument();

    await user.click(seasonsTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Start season" })).not.toBeInTheDocument();
  });

  it("shows audit history including deleted point awards in the Audit section", () => {
    setupAdminForms();
    switchToManageSection("Audit");

    expect(screen.getByText("Alice Admin deleted 12 points from Ben Unassigned.")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin created an invite link.")).toBeInTheDocument();
    expect(screen.getByText("Ben Unassigned joined with an invite link.")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin started Q4 2026.")).toBeInTheDocument();
    expect(screen.getByText("Alice Admin assigned Ben Unassigned to Ravenclaw.")).toBeInTheDocument();
    expect(screen.getByText("Point deleted")).toBeInTheDocument();
    expect(screen.getByText("Invite created")).toBeInTheDocument();
    expect(screen.getByText("Invite used")).toBeInTheDocument();
    expect(screen.getByText("Season started")).toBeInTheDocument();
    expect(screen.getByText("House assigned")).toBeInTheDocument();
  });

  it("shows an empty state when no admin actions have been recorded", () => {
    setupAdminForms({ recentAdminActions: [] });
    switchToManageSection("Audit");

    expect(screen.getByText("No audit history matches this filter yet.")).toBeInTheDocument();
  });

  it("filters audit history by event type", async () => {
    const filteredActions = recentAdminActions.filter((action) => action.type === "POINT_DELETED");
    const { user, props } = setupAdminForms({
      onLoadAdminAudit: vi.fn().mockResolvedValue({
        items: filteredActions,
        nextCursor: null,
      }),
    });
    switchToManageSection("Audit");

    await user.selectOptions(screen.getByLabelText("Filter history"), "POINT_DELETED");

    await waitFor(() => expect(props.onLoadAdminAudit).toHaveBeenCalledWith("POINT_DELETED"));
    expect(screen.getByText("Alice Admin deleted 12 points from Ben Unassigned.")).toBeInTheDocument();
    expect(screen.queryByText("Alice Admin created an invite link.")).not.toBeInTheDocument();
  });

  it("loads additional audit history pages", async () => {
    const nextAction: AdminAuditAction = {
      id: "audit-event:older-role-change",
      type: "USER_ROLE_CHANGED",
      occurredAt: "2026-06-20T12:00:00.000Z",
      actorName: "Olivia Owner",
      summary: "Olivia Owner changed Casey from MEMBER to ADMIN.",
      metadata: {
        targetUserId: "user-casey",
        targetUserName: "Casey",
        previousRole: "MEMBER",
        newRole: "ADMIN",
      },
    };
    const { user, props } = setupAdminForms({
      adminAuditNextCursor: "audit-older-cursor",
      onLoadAdminAudit: vi.fn().mockResolvedValue({
        items: [nextAction],
        nextCursor: null,
      }),
    });
    switchToManageSection("Audit");

    await user.click(screen.getByRole("button", { name: "Load more audit history" }));

    await waitFor(() => expect(props.onLoadAdminAudit).toHaveBeenCalledWith(undefined, "audit-older-cursor"));
    expect(screen.getByText("Olivia Owner changed Casey from MEMBER to ADMIN.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more audit history" })).not.toBeInTheDocument();
  });

  it("shows season management controls with the current active season", () => {
    setupAdminForms();
    switchToManageSection("Seasons");

    expect(screen.getByRole("form", { name: "Start season" })).toHaveTextContent(
      "Current active season: Q3 2026",
    );
    expect(screen.getByRole("form", { name: "Rename season" })).toBeInTheDocument();
  });

  it("confirms and starts a new season for owners", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms();
    switchToManageSection("Seasons");
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

  it("shows a safe toast when start-season returns an expected failure", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms({
      onStartSeason: vi.fn().mockResolvedValue({
        ok: false,
        code: "ACTIVE_SEASON_NOT_FOUND",
        message: "The season could not be started. Please try again.",
      }),
    });
    switchToManageSection("Seasons");
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
    switchToManageSection("Seasons");
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
    switchToManageSection("Seasons");
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
    switchToManageSection("Houses");

    expect(screen.getByLabelText(/House color/)).toHaveAttribute("type", "color");
    expect(screen.getByLabelText(/New color/)).toHaveAttribute("type", "color");
    expect(screen.getAllByText("Choose a house accent color")).toHaveLength(2);
  });

  it("submits create-house data and shows success when the typed result succeeds", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Houses");
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
    switchToManageSection("Houses");
    const createHouseForm = within(screen.getByRole("form", { name: "Create house" }));

    await user.type(createHouseForm.getByPlaceholderText("House name"), "Hufflepuff");
    await user.click(createHouseForm.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to create house", {
      description: "The house could not be created. Please try again.",
    });
  });

  it("sets edit fields to the selected house values", async () => {
    const { user } = setupAdminForms();
    switchToManageSection("Houses");
    const editHouseForm = within(screen.getByRole("form", { name: "Edit house" }));
    const colorInput = editHouseForm.getByLabelText(/New color/) as HTMLInputElement;
    const descriptionInput = editHouseForm.getByPlaceholderText("Description (optional)") as HTMLInputElement;

    expect(colorInput.value).toBe("#7c3aed");
    expect(descriptionInput.value).toBe("");

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Ravenclaw");
    expect(colorInput.value).toBe("#1d4ed8");
    expect(descriptionInput.value).toBe("Curious problem solvers");

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Slytherin");
    expect(colorInput.value).toBe("#22c55e");
    expect(descriptionInput.value).toBe("Ambitious builders");
  });

  it("preserves the selected house description when only changing the edit color", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Houses");
    const editHouseForm = within(screen.getByRole("form", { name: "Edit house" }));

    await user.selectOptions(editHouseForm.getByLabelText("House to edit"), "Ravenclaw");
    fireEvent.change(editHouseForm.getByLabelText(/New color/), {
      target: { value: "#9333ea" },
    });
    await user.click(editHouseForm.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());
    const createHouseMock = props.onCreateHouse as ReturnType<typeof vi.fn>;
    const formData = createHouseMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      name: "Ravenclaw",
      color: "#9333ea",
      description: "Curious problem solvers",
    });
  });

  it("shows a safe toast when edit-house returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateHouse: vi.fn().mockResolvedValue({
        ok: false,
        code: "HOUSE_ALREADY_EXISTS",
        message: "The house could not be created. Please try again.",
      }),
    });
    switchToManageSection("Houses");
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
    switchToManageSection("Team");
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

  it("lets owners promote members to admins from the Team section", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms();
    switchToManageSection("Team");
    const promoteForm = within(screen.getByRole("form", { name: "Promote member" }));

    await user.selectOptions(promoteForm.getByLabelText("Member to promote"), "user-2");
    await user.click(promoteForm.getByRole("button", { name: "Promote to admin" }));

    await waitFor(() => expect(props.onPromoteUser).toHaveBeenCalledOnce());
    expect(confirmSpy).toHaveBeenCalledWith(
      "Promote Ben Unassigned to admin? They will be able to invite members, assign houses, award points, and delete point awards.",
    );

    const promoteMock = props.onPromoteUser as ReturnType<typeof vi.fn>;
    const formData = promoteMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
      role: "ADMIN",
    });
    confirmSpy.mockRestore();
  });

  it("shows role promotion to admins but keeps it owner-only", () => {
    setupAdminForms({ actorRole: "ADMIN" });
    switchToManageSection("Team");
    const promoteForm = within(screen.getByRole("form", { name: "Promote member" }));

    expect(promoteForm.getByText("Owner only")).toBeInTheDocument();
    expect(promoteForm.getByLabelText("Member to promote")).toBeDisabled();
    expect(promoteForm.getByRole("button", { name: "Promote to admin" })).toBeDisabled();
  });

  it("shows a safe toast when role promotion returns an expected failure", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, props } = setupAdminForms({
      onPromoteUser: vi.fn().mockResolvedValue({
        ok: false,
        code: "OWNER_REQUIRED",
        message: "The member role could not be updated. Please try again.",
      }),
    });
    switchToManageSection("Team");
    const promoteForm = within(screen.getByRole("form", { name: "Promote member" }));

    await user.selectOptions(promoteForm.getByLabelText("Member to promote"), "user-2");
    await user.click(promoteForm.getByRole("button", { name: "Promote to admin" }));

    await waitFor(() => expect(props.onPromoteUser).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update role", {
      description: "The member role could not be updated. Please try again.",
    });
    confirmSpy.mockRestore();
  });

  it("shows a safe toast when assignment returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onAssignHouse: vi.fn().mockResolvedValue({
        ok: false,
        code: "USER_NOT_FOUND",
        message: "The user could not be assigned to that house. Please try again.",
      }),
    });
    switchToManageSection("Team");
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
    switchToManageSection("Team");
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

  it("shows invite generation and use reporting in the Team section", () => {
    setupAdminForms();
    switchToManageSection("Team");

    const inviteActivity = within(screen.getByLabelText("Invite activity"));

    expect(inviteActivity.getByText("Tokens generated")).toBeInTheDocument();
    expect(inviteActivity.getByText("Tokens used")).toBeInTheDocument();
    expect(inviteActivity.getByText("Token generated")).toBeInTheDocument();
    expect(inviteActivity.getByText("Token used")).toBeInTheDocument();
    expect(inviteActivity.getByText("Alice Admin created an invite link.")).toBeInTheDocument();
    expect(inviteActivity.getByText("Ben Unassigned joined with an invite link.")).toBeInTheDocument();
  });

  it("shows an empty invite activity state when no invite events exist", () => {
    setupAdminForms({
      recentAdminActions: recentAdminActions.filter(
        (action) => action.type !== "INVITE_CREATED" && action.type !== "INVITE_USED",
      ),
    });
    switchToManageSection("Team");

    expect(screen.getByText("No invite activity has been recorded yet.")).toBeInTheDocument();
  });

  it("shows generated invite tokens in the invite card", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Team");

    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite token" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(inviteCard.getByText("invite-token")).toBeInTheDocument();
    expect(inviteCard.getByTitle("Copy token")).toBeInTheDocument();
  });

  it("contains long generated invite tokens inside the invite card", async () => {
    const longToken = "5dfc1b66d5c131efdfdf0d4c28de4062ebaebd5e6db57e104f0a8f93c2d1";
    const { user } = setupAdminForms({
      onCreateInvite: vi.fn().mockResolvedValue({
        ok: true,
        token: longToken,
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    });
    switchToManageSection("Team");
    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite token" }),
    );

    const tokenCode = inviteCard.getByText(longToken);
    expect(tokenCode).toHaveClass("min-w-0", "truncate");
    expect(tokenCode.parentElement).toHaveClass("min-w-0");
  });

  it("shows a safe toast when invite generation returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateInvite: vi.fn().mockResolvedValue({
        ok: false,
        code: "INVITE_LIMIT_REACHED",
        message: "An invite could not be generated. Please try again.",
      }),
    });
    switchToManageSection("Team");

    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite token" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(screen.queryByText("invite-token")).not.toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to generate invite", {
      description: "An invite could not be generated. Please try again.",
    });
  });
});
