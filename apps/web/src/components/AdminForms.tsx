"use client";

import { useState } from "react";
import type { AdminAuditAction, DeletedPoint, InviteStats, PagedAdminAuditActions, PointAdjustmentStats, Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
  HouseMutationResult,
  RenameSeasonResult,
  RoleChangeResult,
  StartSeasonResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";
import { HouseManagement } from "./HouseManagement";
import { ManageOverview } from "./ManageOverview";
import { RecentAdminActionsReport } from "./RecentAdminActionsReport";
import { SeasonManagement } from "./SeasonManagement";
import { TeamManagement } from "./TeamManagement";

interface AdminFormsProps {
  users: AdminUser[];
  houses: AdminHouse[];
  seasons: Season[];
  activeSeason: Season;
  actorRole: UserRole;
  recentDeletedPoints: DeletedPoint[];
  recentAdminActions: AdminAuditAction[];
  inviteStats: InviteStats;
  pointAdjustmentStats: PointAdjustmentStats;
  adminAuditNextCursor: string | null;
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onPromoteUser: (formData: FormData) => Promise<RoleChangeResult>;
  onLoadAdminAudit: (
    type?: AdminAuditAction["type"],
    cursor?: string,
  ) => Promise<PagedAdminAuditActions>;
  onLoadPointAdjustmentStats: (seasonId?: string) => Promise<PointAdjustmentStats>;
  onCreateInvite: () => Promise<CreateInviteResult>;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

type ManageSectionId = "overview" | "team" | "houses" | "seasons" | "audit";

const MANAGE_SECTIONS: Array<{
  id: ManageSectionId;
  label: string;
  description: string;
  ownerOnly?: boolean;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Operational totals and quick health signals.",
  },
  {
    id: "team",
    label: "Team",
    description: "Invite members and assign houses.",
  },
  {
    id: "houses",
    label: "Houses",
    description: "Create and update house details.",
    ownerOnly: true,
  },
  {
    id: "seasons",
    label: "Seasons",
    description: "Rename seasons or start the next competition window.",
    ownerOnly: true,
  },
  {
    id: "audit",
    label: "Audit",
    description: "Review the full administrative history.",
  },
];

export function AdminForms({
  users,
  houses,
  seasons,
  activeSeason,
  actorRole,
  recentDeletedPoints,
  recentAdminActions,
  inviteStats,
  pointAdjustmentStats,
  adminAuditNextCursor,
  onCreateHouse,
  onAssignHouse,
  onPromoteUser,
  onLoadAdminAudit,
  onLoadPointAdjustmentStats,
  onCreateInvite,
  onStartSeason,
  onRenameSeason,
}: AdminFormsProps) {
  const [activeSection, setActiveSection] = useState<ManageSectionId>("overview");
  const isOwner = actorRole === "OWNER";
  const unassignedUsers = users.filter((user) => !user.houseId);
  const assignedUsers = users.filter((user) => user.houseId);
  const unassignedCount = unassignedUsers.length;
  const unassignedSummary =
    unassignedCount === 1 ? "1 needs assignment" : `${unassignedCount} need assignment`;
  const activeSectionDefinition = MANAGE_SECTIONS.find((section) => section.id === activeSection);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-3">
        <div
          role="tablist"
          aria-label="Manage sections"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        >
          {MANAGE_SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            const isDisabled = section.ownerOnly === true && !isOwner;

            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-disabled={isDisabled}
                aria-controls={`manage-section-${section.id}`}
                id={`manage-tab-${section.id}`}
                disabled={isDisabled}
                title={isDisabled ? `${section.label} is owner-only` : undefined}
                onClick={() => setActiveSection(section.id)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : isDisabled
                      ? "bg-muted/40 text-muted-foreground opacity-70 cursor-not-allowed"
                      : "bg-background/60 hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                  <span>{section.label}</span>
                  {isDisabled ? (
                    <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
                      Owner only
                    </span>
                  ) : null}
                </span>
                <span
                  className={`mt-1 block text-xs ${
                    isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {section.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`manage-section-${activeSection}`}
        aria-labelledby={`manage-tab-${activeSection}`}
        className="space-y-6"
      >
        <div>
          <p className="text-sm font-medium text-primary">Manage</p>
          <h3 className="font-display text-2xl font-semibold mt-1">
            {activeSectionDefinition?.label}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {activeSectionDefinition?.description}
          </p>
        </div>

        {activeSection === "overview" ? (
          <ManageOverview
            memberCount={users.length}
            houseCount={houses.length}
            unassignedCount={unassignedCount}
            deletedPointCount={recentDeletedPoints.length}
            pointAdjustmentStats={pointAdjustmentStats}
            seasons={seasons}
            onLoadPointAdjustmentStats={onLoadPointAdjustmentStats}
          />
        ) : null}

        {activeSection === "team" ? (
          <TeamManagement
            users={users}
            houses={houses}
            unassignedUsers={unassignedUsers}
            assignedUsers={assignedUsers}
            unassignedSummary={unassignedSummary}
            recentAdminActions={recentAdminActions}
            inviteStats={inviteStats}
            actorRole={actorRole}
            onAssignHouse={onAssignHouse}
            onPromoteUser={onPromoteUser}
            onCreateInvite={onCreateInvite}
          />
        ) : null}

        {activeSection === "houses" ? (
          <HouseManagement
            houses={houses}
            onCreateHouse={onCreateHouse}
          />
        ) : null}

        {activeSection === "seasons" ? (
          <SeasonManagement
            seasons={seasons}
            activeSeason={activeSeason}
            actorRole={actorRole}
            onStartSeason={onStartSeason}
            onRenameSeason={onRenameSeason}
          />
        ) : null}

        {activeSection === "audit" ? (
          <RecentAdminActionsReport
            actions={recentAdminActions}
            nextCursor={adminAuditNextCursor}
            onLoadPage={onLoadAdminAudit}
          />
        ) : null}
      </div>
    </div>
  );
}
