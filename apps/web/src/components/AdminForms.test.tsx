import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AdminAuditAction, PointAdjustmentStats } from "@housepoints/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminForms } from "./AdminForms";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const routerReplaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
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
    type: "AWARD" as const,
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
    organization: {
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
    },
    seasons: [activeSeason, historicalSeason],
    activeSeason,
    actorRole: "OWNER" as const,
    recentDeletedPoints,
    recentAdminActions,
    inviteStats: {
      generatedCount: 3,
      usedCount: 2,
    },
    pointAdjustmentStats: {
      seasonId: "season-active",
      seasonName: "Q3 2026",
      totalDeductionCount: 2,
      totalDeductedPoints: 20,
      byHouse: [
        {
          houseId: "house-1",
          houseName: "Slytherin",
          houseColor: "#22c55e",
          deductionCount: 2,
          deductedPoints: 20,
        },
        {
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          deductionCount: 0,
          deductedPoints: 0,
        },
      ],
    },
    adminAuditNextCursor: null,
    onCreateHouse: vi.fn().mockResolvedValue({ ok: true }),
    onAssignHouse: vi.fn().mockResolvedValue({ ok: true }),
    onUpdateMemberDisplayName: vi.fn().mockResolvedValue({ ok: true }),
    onPromoteUser: vi.fn().mockResolvedValue({ ok: true }),
    onRemoveOrgMember: vi.fn().mockResolvedValue({ ok: true }),
    onTransferOwnership: vi.fn().mockResolvedValue({ ok: true }),
    onUpdateOrgSlug: vi.fn().mockResolvedValue({ ok: true }),
    onUpdateOrgSettings: vi.fn().mockResolvedValue({ ok: true }),
    onArchiveOrganization: vi.fn().mockResolvedValue({ ok: true, redirectTo: "/o/acme" }),
    onLoadAdminAudit: vi.fn().mockResolvedValue({
      items: recentAdminActions,
      nextCursor: null,
    }),
    onLoadPointAdjustmentStats: vi.fn().mockResolvedValue({
      seasonId: "season-active",
      seasonName: "Q3 2026",
      totalDeductionCount: 2,
      totalDeductedPoints: 20,
      byHouse: [
        {
          houseId: "house-1",
          houseName: "Slytherin",
          houseColor: "#22c55e",
          deductionCount: 2,
          deductedPoints: 20,
        },
        {
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          deductionCount: 0,
          deductedPoints: 0,
        },
      ],
    } satisfies PointAdjustmentStats),
    onCreateInvite: vi.fn().mockResolvedValue({
      ok: true,
      token: "invite-token",
      joinPath: "/o/acme/join/invite-token",
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
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("defaults to the Manage overview and exposes focused section navigation", () => {
    setupAdminForms();

    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Members/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByLabelText("Point adjustment activity")).toBeInTheDocument();
    const adjustmentActivity = within(screen.getByLabelText("Point adjustment activity"));
    expect(adjustmentActivity.getByText("Season: Q3 2026")).toBeInTheDocument();
    expect(adjustmentActivity.getByText("Points deducted")).toBeInTheDocument();
    expect(adjustmentActivity.getByText("Deduction events")).toBeInTheDocument();
    expect(adjustmentActivity.getByText("Slytherin")).toBeInTheDocument();
    expect(adjustmentActivity.getByText("2 deductions")).toBeInTheDocument();
    expect(adjustmentActivity.getAllByText("20")[0]).toBeInTheDocument();

    switchToManageSection("Settings");
    expect(screen.getByRole("tab", { name: /Settings/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Organization Settings")).toBeInTheDocument();

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
    const settingsTab = screen.getByRole("tab", { name: /Settings/ });
    const rolesTab = screen.getByRole("tab", { name: /Roles/ });

    expect(settingsTab).toBeVisible();
    expect(housesTab).toBeVisible();
    expect(seasonsTab).toBeVisible();
    expect(rolesTab).toBeVisible();
    expect(settingsTab).toBeDisabled();
    expect(housesTab).toBeDisabled();
    expect(seasonsTab).toBeDisabled();
    expect(rolesTab).toBeDisabled();
    expect(settingsTab).toHaveAttribute("aria-disabled", "true");
    expect(housesTab).toHaveAttribute("aria-disabled", "true");
    expect(seasonsTab).toHaveAttribute("aria-disabled", "true");
    expect(rolesTab).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Owner only")).toHaveLength(4);

    await user.click(settingsTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Organization settings" })).not.toBeInTheDocument();

    await user.click(housesTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Create house" })).not.toBeInTheDocument();

    await user.click(seasonsTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Start season" })).not.toBeInTheDocument();

    await user.click(rolesTab);
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Promote member" })).not.toBeInTheDocument();
  });

  it("lets owners update organization settings", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const settingsForm = within(screen.getByRole("form", { name: "Organization settings" }));
    const nameInput = settingsForm.getByLabelText("Organization name") as HTMLInputElement;

    expect(nameInput.value).toBe("Acme Corp");
    expect(settingsForm.getByText("acme")).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, "House Points Guild");
    await user.click(settingsForm.getByRole("button", { name: "Save organization" }));

    await waitFor(() => expect(props.onUpdateOrgSettings).toHaveBeenCalledOnce());
    const updateMock = props.onUpdateOrgSettings as ReturnType<typeof vi.fn>;
    const formData = updateMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      name: "House Points Guild",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Organization updated", {
      description: "House Points Guild",
    });
  });

  it("lets owners change the organization slug with confirmation", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const slugForm = within(screen.getByRole("form", { name: "Organization slug" }));

    expect(slugForm.getByText("Previous slugs stay reserved so old links cannot be claimed by another organization.")).toBeInTheDocument();

    await user.type(slugForm.getByLabelText("New slug"), "acme-corp");
    await user.type(slugForm.getByLabelText("Confirm current slug"), "acme");
    await user.click(slugForm.getByRole("button", { name: "Change organization slug" }));

    await waitFor(() => expect(props.onUpdateOrgSlug).toHaveBeenCalledOnce());
    const updateMock = props.onUpdateOrgSlug as ReturnType<typeof vi.fn>;
    const formData = updateMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      slug: "acme-corp",
      confirmation: "acme",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Organization slug updated", {
      description: "acme-corp",
    });
  });

  it("does not submit slug changes when confirmation does not match", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const slugForm = within(screen.getByRole("form", { name: "Organization slug" }));

    await user.type(slugForm.getByLabelText("New slug"), "acme-corp");
    await user.type(slugForm.getByLabelText("Confirm current slug"), "wrong");
    await user.click(slugForm.getByRole("button", { name: "Change organization slug" }));

    expect(props.onUpdateOrgSlug).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Slug confirmation does not match", {
      description: "Type acme to confirm this change.",
    });
  });

  it("lets owners transfer ownership from the Settings section", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const transferForm = within(screen.getByRole("form", { name: "Transfer ownership" }));

    await user.selectOptions(transferForm.getByLabelText("New owner"), "user-2");
    await user.type(transferForm.getByLabelText("Confirm transfer"), "TRANSFER");
    await user.click(transferForm.getByRole("button", { name: "Transfer ownership" }));

    await screen.findByText("Transfer ownership to Ben Unassigned?");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onTransferOwnership).toHaveBeenCalledOnce());
    const transferMock = props.onTransferOwnership as ReturnType<typeof vi.fn>;
    const formData = transferMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
      confirmation: "TRANSFER",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Ownership transferred", {
      description: "Ben Unassigned is now the organization owner.",
    });
  });

  it("opens a deep-linked Manage section and preserves other query parameters when navigating", () => {
    window.history.replaceState(
      null,
      "",
      "/?tab=manage&manage=members&season=season-active",
    );
    const pushState = vi.spyOn(window.history, "pushState");

    setupAdminForms();

    expect(screen.getByRole("tab", { name: /Members/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();

    switchToManageSection("Audit");

    expect(pushState).toHaveBeenLastCalledWith(
      null,
      "",
      "?tab=manage&manage=audit&season=season-active",
    );
    expect(screen.getByRole("tab", { name: /Audit/ })).toHaveAttribute("aria-selected", "true");
  });

  it("falls back to Overview when an admin deep-links to an owner-only section", () => {
    window.history.replaceState(null, "", "/?tab=manage&manage=settings");

    setupAdminForms({ actorRole: "ADMIN" });

    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("form", { name: "Organization settings" })).not.toBeInTheDocument();
  });

  it("removes the Manage section parameter when returning to Overview", () => {
    window.history.replaceState(null, "", "/?tab=manage&manage=audit");
    const pushState = vi.spyOn(window.history, "pushState");

    setupAdminForms();
    switchToManageSection("Overview");

    expect(pushState).toHaveBeenLastCalledWith(null, "", "?tab=manage");
    expect(screen.getByRole("tab", { name: /Overview/ })).toHaveAttribute("aria-selected", "true");
  });

  it("lets owners archive the organization only after typing the current slug", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const archiveForm = within(screen.getByRole("form", { name: "Archive organization" }));
    const archiveButton = archiveForm.getByRole("button", { name: "Archive organization" });

    expect(archiveForm.getByText("This is a soft delete. Data is retained for audit and future recovery work, but users cannot continue using the archived organization.")).toBeInTheDocument();
    expect(archiveButton).toBeDisabled();

    await user.type(archiveForm.getByLabelText("Confirm archive"), "acme");

    expect(archiveButton).toBeEnabled();
    await user.click(archiveButton);

    await waitFor(() => expect(props.onArchiveOrganization).toHaveBeenCalledOnce());
    const archiveMock = props.onArchiveOrganization as ReturnType<typeof vi.fn>;
    const formData = archiveMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      confirmation: "acme",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Organization archived", {
      description: "Opening the archived organization page.",
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/o/acme");
  });

  it("shows a safe toast when organization archive fails", async () => {
    const { user, props } = setupAdminForms({
      onArchiveOrganization: vi.fn().mockResolvedValue({
        ok: false,
        code: "OWNER_REQUIRED",
        message: "The organization could not be archived. Please try again.",
      }),
    });
    switchToManageSection("Settings");
    const archiveForm = within(screen.getByRole("form", { name: "Archive organization" }));

    await user.type(archiveForm.getByLabelText("Confirm archive"), "acme");
    await user.click(archiveForm.getByRole("button", { name: "Archive organization" }));

    await waitFor(() => expect(props.onArchiveOrganization).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to archive organization", {
      description: "The organization could not be archived. Please try again.",
    });
  });

  it("does not submit ownership transfer when confirmation does not match", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Settings");
    const transferForm = within(screen.getByRole("form", { name: "Transfer ownership" }));

    await user.selectOptions(transferForm.getByLabelText("New owner"), "user-2");
    await user.type(transferForm.getByLabelText("Confirm transfer"), "wrong");
    await user.click(transferForm.getByRole("button", { name: "Transfer ownership" }));

    expect(props.onTransferOwnership).not.toHaveBeenCalled();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Ownership confirmation does not match", {
      description: "Type TRANSFER to confirm this change.",
    });
  });

  it("shows a safe toast when organization slug update fails", async () => {
    const { user, props } = setupAdminForms({
      onUpdateOrgSlug: vi.fn().mockResolvedValue({
        ok: false,
        code: "SLUG_TAKEN",
        message: "That organization slug is already reserved. Choose a different one.",
      }),
    });
    switchToManageSection("Settings");
    const slugForm = within(screen.getByRole("form", { name: "Organization slug" }));

    await user.type(slugForm.getByLabelText("New slug"), "reserved-slug");
    await user.type(slugForm.getByLabelText("Confirm current slug"), "acme");
    await user.click(slugForm.getByRole("button", { name: "Change organization slug" }));

    await waitFor(() => expect(props.onUpdateOrgSlug).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update organization slug", {
      description: "That organization slug is already reserved. Choose a different one.",
    });
  });

  it("shows a safe toast when organization settings update fails", async () => {
    const { user, props } = setupAdminForms({
      onUpdateOrgSettings: vi.fn().mockResolvedValue({
        ok: false,
        code: "OWNER_REQUIRED",
        message: "The organization settings could not be updated. Please try again.",
      }),
    });
    switchToManageSection("Settings");
    const settingsForm = within(screen.getByRole("form", { name: "Organization settings" }));
    const nameInput = settingsForm.getByLabelText("Organization name");

    await user.clear(nameInput);
    await user.type(nameInput, "House Points Guild");
    await user.click(settingsForm.getByRole("button", { name: "Save organization" }));

    await waitFor(() => expect(props.onUpdateOrgSettings).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update organization", {
      description: "The organization settings could not be updated. Please try again.",
    });
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

  it("shows an empty point-adjustment state when no deductions exist", () => {
    setupAdminForms({
      pointAdjustmentStats: {
        seasonId: "season-active",
        seasonName: "Q3 2026",
        totalDeductionCount: 0,
        totalDeductedPoints: 0,
        byHouse: houses.map((house) => ({
          houseId: house.id,
          houseName: house.name,
          houseColor: house.color,
          deductionCount: 0,
          deductedPoints: 0,
        })),
      },
    });

    expect(screen.getByText("No point deductions have been recorded for this season.")).toBeInTheDocument();
  });

  it("loads point-adjustment reporting for a selected historical season", async () => {
    const historicalStats: PointAdjustmentStats = {
      seasonId: "season-0",
      seasonName: "Season 0",
      totalDeductionCount: 1,
      totalDeductedPoints: 10,
      byHouse: [
        {
          houseId: "house-1",
          houseName: "Slytherin",
          houseColor: "#22c55e",
          deductionCount: 0,
          deductedPoints: 0,
        },
        {
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#1d4ed8",
          deductionCount: 1,
          deductedPoints: 10,
        },
      ],
    };
    const { user, props } = setupAdminForms({
      onLoadPointAdjustmentStats: vi.fn().mockResolvedValue(historicalStats),
    });
    const adjustmentActivity = within(screen.getByLabelText("Point adjustment activity"));

    await user.selectOptions(adjustmentActivity.getByLabelText("Reporting season"), "season-0");

    await waitFor(() => expect(props.onLoadPointAdjustmentStats).toHaveBeenCalledWith("season-0"));
    await waitFor(() => expect(adjustmentActivity.getByText("Season: Season 0")).toBeInTheDocument());
    expect(adjustmentActivity.getByText("Ravenclaw")).toBeInTheDocument();
    expect(adjustmentActivity.getByText("1 deduction")).toBeInTheDocument();
    expect(adjustmentActivity.getAllByText("10")).toHaveLength(2);
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
    const { user, props } = setupAdminForms();
    switchToManageSection("Seasons");
    const startSeasonForm = within(screen.getByRole("form", { name: "Start season" }));

    await user.type(startSeasonForm.getByPlaceholderText("New season name"), "Q4 2026");
    await user.click(startSeasonForm.getByRole("button", { name: "Start season" }));

    await screen.findByText(/Start .Q4 2026. now\?/);
    await user.click(startSeasonForm.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onStartSeason).toHaveBeenCalledOnce());
    const startSeasonMock = props.onStartSeason as ReturnType<typeof vi.fn>;
    const formData = startSeasonMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({ name: "Q4 2026" });
    await screen.findByText(/Current active season:/);
    expect(startSeasonForm.getByText("Q4 2026")).toBeInTheDocument();
  });

  it("shows a safe toast when start-season returns an expected failure", async () => {
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

    await screen.findByText(/Start .Q4 2026. now\?/);
    await user.click(startSeasonForm.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onStartSeason).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to start season", {
      description: "The season could not be started. Please try again.",
    });
    expect(startSeasonForm.getByText("Q3 2026")).toBeInTheDocument();
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
    expect(screen.getAllByText("House theme preview")).toHaveLength(2);
    expect(screen.getAllByText("Theme ready")).toHaveLength(2);
    expect(screen.getAllByText("This color is ready for readable house themes.")).toHaveLength(2);
    expect(screen.getAllByRole("group", { name: /generated house theme preview/i })).toHaveLength(2);
    expect(screen.getAllByText("Selected surface")).toHaveLength(2);
    expect(screen.getAllByText("Dashboard card preview")).toHaveLength(2);
  });

  it("shows a warning when a house color would make a muted app theme", () => {
    setupAdminForms();
    switchToManageSection("Houses");
    const createHouseForm = within(screen.getByRole("form", { name: "Create house" }));

    fireEvent.change(createHouseForm.getByLabelText(/House color/), {
      target: { value: "#777777" },
    });

    expect(createHouseForm.getByText("Theme subtle")).toBeInTheDocument();
    expect(createHouseForm.getByText("This color is readable, but it may feel muted as an app theme.")).toBeInTheDocument();
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
      themeMode: "GENERATED",
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
      themeMode: "GENERATED",
      description: "Curious problem solvers",
    });
  });

  it("submits custom house palette data when custom mode is selected", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Houses");
    const createHouseForm = within(screen.getByRole("form", { name: "Create house" }));

    await user.type(createHouseForm.getByPlaceholderText("House name"), "Gryffindor");
    await user.click(createHouseForm.getByLabelText("Custom palette"));
    fireEvent.change(createHouseForm.getByLabelText("Secondary color"), {
      target: { value: "#dc2626" },
    });
    fireEvent.change(createHouseForm.getByLabelText("Surface tint"), {
      target: { value: "#fff1f2" },
    });
    await user.click(createHouseForm.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(props.onCreateHouse).toHaveBeenCalledOnce());
    const createHouseMock = props.onCreateHouse as ReturnType<typeof vi.fn>;
    const formData = createHouseMock.mock.calls[0][0] as FormData;

    expect(Object.fromEntries(formData.entries())).toEqual({
      name: "Gryffindor",
      color: "#7c3aed",
      themeMode: "CUSTOM",
      themeSecondaryColor: "#dc2626",
      themeSurfaceColor: "#fff1f2",
      description: "",
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
    switchToManageSection("Members");
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

  it("stacks member assignment controls vertically inside the card", () => {
    setupAdminForms();
    switchToManageSection("Members");
    const assignForm = within(screen.getByRole("form", { name: "Assign user to house" }));
    const memberSelect = assignForm.getByLabelText("Member to assign");
    const houseSelect = assignForm.getByLabelText("House assignment");
    const assignButton = assignForm.getByRole("button", { name: "Assign" });

    expect(memberSelect).toHaveClass("w-full", "min-w-0");
    expect(houseSelect).toHaveClass("w-full", "min-w-0");
    expect(assignButton).toHaveClass("w-full");
  });

  it("lets admins update member display names from the Members section", async () => {
    const { user, props } = setupAdminForms({ actorRole: "ADMIN" });
    switchToManageSection("Members");
    const displayNameForm = within(screen.getByRole("form", { name: "Update member display name" }));

    await user.selectOptions(displayNameForm.getByLabelText("Member display name target"), "user-2");
    await user.type(displayNameForm.getByLabelText("New display name"), "Ben Updated");
    await user.click(displayNameForm.getByRole("button", { name: "Update display name" }));

    await waitFor(() => expect(props.onUpdateMemberDisplayName).toHaveBeenCalledOnce());

    const updateDisplayNameMock = props.onUpdateMemberDisplayName as ReturnType<typeof vi.fn>;
    const formData = updateDisplayNameMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
      displayName: "Ben Updated",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Display name updated", {
      description: "Ben Unassigned -> Ben Updated",
    });
  });

  it("shows a safe toast when display-name update returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      actorRole: "ADMIN",
      onUpdateMemberDisplayName: vi.fn().mockResolvedValue({
        ok: false,
        code: "DISPLAY_NAME_UNCHANGED",
        message: "That member already has this display name.",
      }),
    });
    switchToManageSection("Members");
    const displayNameForm = within(screen.getByRole("form", { name: "Update member display name" }));

    await user.selectOptions(displayNameForm.getByLabelText("Member display name target"), "user-2");
    await user.type(displayNameForm.getByLabelText("New display name"), "Ben Unassigned");
    await user.click(displayNameForm.getByRole("button", { name: "Update display name" }));

    await waitFor(() => expect(props.onUpdateMemberDisplayName).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update display name", {
      description: "That member already has this display name.",
    });
  });

  it("lets owners promote members to admins from the Roles section", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Roles");
    const promoteForm = within(screen.getByRole("form", { name: "Promote member" }));

    await user.selectOptions(promoteForm.getByLabelText("Member to promote"), "user-2");
    await user.click(promoteForm.getByRole("button", { name: "Promote to admin" }));

    expect(screen.getByText("Promote Ben Unassigned to admin?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onPromoteUser).toHaveBeenCalledOnce());
    const promoteMock = props.onPromoteUser as ReturnType<typeof vi.fn>;
    const formData = promoteMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
      role: "ADMIN",
    });
  });

  it("lets owners remove admin access from the Roles section", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Roles");
    const demoteForm = within(screen.getByRole("form", { name: "Remove admin access" }));

    await user.selectOptions(demoteForm.getByLabelText("Admin to demote"), "user-1");
    await user.click(demoteForm.getByRole("button", { name: "Remove admin access" }));

    expect(screen.getByText("Remove admin access for Alice Assigned?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onPromoteUser).toHaveBeenCalledOnce());
    const roleChangeMock = props.onPromoteUser as ReturnType<typeof vi.fn>;
    const formData = roleChangeMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-1",
      role: "MEMBER",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Admin access removed", {
      description: "Alice Assigned is now a member.",
    });
  });

  it("shows the Roles section as owner-only for admins", () => {
    setupAdminForms({ actorRole: "ADMIN" });
    const rolesTab = screen.getByRole("tab", { name: /Roles/ });

    expect(rolesTab).toBeVisible();
    expect(rolesTab).toBeDisabled();
    expect(rolesTab).toHaveAttribute("aria-disabled", "true");
    expect(rolesTab).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("form", { name: "Promote member" })).not.toBeInTheDocument();
  });

  it("lets owners remove non-owner members from the Members section", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Members");
    const removalForm = within(screen.getByRole("form", { name: "Remove organization member" }));

    await user.selectOptions(removalForm.getByLabelText("Member to remove"), "user-2");
    await user.click(removalForm.getByRole("button", { name: "Remove member" }));

    expect(screen.getByText("Remove Ben Unassigned from the organization?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm removal" }));

    await waitFor(() => expect(props.onRemoveOrgMember).toHaveBeenCalledOnce());
    const removeMock = props.onRemoveOrgMember as ReturnType<typeof vi.fn>;
    const formData = removeMock.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(formData.entries())).toEqual({
      targetUserId: "user-2",
    });
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Member removed", {
      description: "Ben Unassigned no longer has access to this organization.",
    });
  });

  it("shows member removal to admins but keeps it owner-only", () => {
    setupAdminForms({ actorRole: "ADMIN" });
    switchToManageSection("Members");
    const removalSection = within(screen.getByLabelText("Member removal"));
    const removalForm = within(screen.getByRole("form", { name: "Remove organization member" }));

    expect(removalSection.getByText("Owner only")).toBeInTheDocument();
    expect(removalForm.getByLabelText("Member to remove")).toBeDisabled();
    expect(removalForm.getByRole("button", { name: "Remove member" })).toBeDisabled();
  });

  it("shows a safe toast when role promotion returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onPromoteUser: vi.fn().mockResolvedValue({
        ok: false,
        code: "OWNER_REQUIRED",
        message: "The member role could not be updated. Please try again.",
      }),
    });
    switchToManageSection("Roles");
    const promoteForm = within(screen.getByRole("form", { name: "Promote member" }));

    await user.selectOptions(promoteForm.getByLabelText("Member to promote"), "user-2");
    await user.click(promoteForm.getByRole("button", { name: "Promote to admin" }));

    expect(screen.getByText("Promote Ben Unassigned to admin?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(props.onPromoteUser).toHaveBeenCalledOnce());
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to update role", {
      description: "The member role could not be updated. Please try again.",
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
    switchToManageSection("Members");
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
    switchToManageSection("Members");
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

  it("shows invite generation and use reporting in the Members section", () => {
    setupAdminForms();
    switchToManageSection("Members");

    const inviteActivity = within(screen.getByLabelText("Invite activity"));

    expect(inviteActivity.getByText("3")).toBeInTheDocument();
    expect(inviteActivity.getByText("Tokens generated")).toBeInTheDocument();
    expect(inviteActivity.getByText("2")).toBeInTheDocument();
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
    switchToManageSection("Members");

    expect(screen.getByText("No invite activity has been recorded yet.")).toBeInTheDocument();
  });

  it("shows generated invite links in the invite card", async () => {
    const { user, props } = setupAdminForms();
    switchToManageSection("Members");

    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite link" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(inviteCard.getByText(/\/o\/acme\/join\/invite-token$/)).toBeInTheDocument();
    expect(inviteCard.getByTitle("Copy invite link")).toBeInTheDocument();
  });

  it("contains long generated invite links inside the invite card", async () => {
    const longToken = "5dfc1b66d5c131efdfdf0d4c28de4062ebaebd5e6db57e104f0a8f93c2d1";
    const longJoinPath = `/o/acme/join/${longToken}`;
    const { user } = setupAdminForms({
      onCreateInvite: vi.fn().mockResolvedValue({
        ok: true,
        token: longToken,
        joinPath: longJoinPath,
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
    });
    switchToManageSection("Members");
    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite link" }),
    );

    const linkCode = inviteCard.getByText(new RegExp(`${longToken}$`));
    expect(linkCode).toHaveClass("min-w-0", "truncate");
    expect(linkCode.parentElement).toHaveClass("min-w-0", "overflow-hidden");
    expect(linkCode.parentElement?.parentElement).toHaveClass("min-w-0", "overflow-hidden");
    expect(screen.getByLabelText("Invite member")).toHaveClass("min-w-0", "overflow-hidden");
  });

  it("shows a safe toast when invite generation returns an expected failure", async () => {
    const { user, props } = setupAdminForms({
      onCreateInvite: vi.fn().mockResolvedValue({
        ok: false,
        code: "INVITE_LIMIT_REACHED",
        message: "An invite could not be generated. Please try again.",
      }),
    });
    switchToManageSection("Members");

    const inviteCard = within(screen.getByLabelText("Invite member"));

    await user.click(
      inviteCard.getByRole("button", { name: "Generate invite link" }),
    );

    await waitFor(() => expect(props.onCreateInvite).toHaveBeenCalledOnce());
    expect(screen.queryByText("invite-token")).not.toBeInTheDocument();
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalledWith("Failed to generate invite", {
      description: "An invite could not be generated. Please try again.",
    });
  });
});
