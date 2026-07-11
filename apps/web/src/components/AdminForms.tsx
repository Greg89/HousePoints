"use client";

import { useState, type ReactNode } from "react";
import {
  Calendar,
  ChartBar,
  ClipboardText,
  Gear,
  House,
  ShieldCheck,
  Trash,
  TrendDown,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";
import type { AdminAuditAction, DeletedPoint, InviteStats, OrgSettings, PagedAdminAuditActions, PointAdjustmentStats, Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  ArchiveOrganizationResult,
  HouseAssignmentResult,
  HouseMutationResult,
  MemberDisplayNameResult,
  MemberRemovalResult,
  OrgSettingsMutationResult,
  RenameSeasonResult,
  RoleChangeResult,
  StartSeasonResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";
import { HouseManagement } from "./HouseManagement";
import { ManageOverview } from "./ManageOverview";
import { OrgSettingsManagement } from "./OrgSettingsManagement";
import { RecentAdminActionsReport } from "./RecentAdminActionsReport";
import { RoleManagement } from "./RoleManagement";
import { SeasonManagement } from "./SeasonManagement";
import { TeamManagement } from "./TeamManagement";

interface AdminFormsProps {
  users: AdminUser[];
  houses: AdminHouse[];
  seasons: Season[];
  activeSeason: Season;
  organization: OrgSettings;
  actorRole: UserRole;
  recentDeletedPoints: DeletedPoint[];
  recentAdminActions: AdminAuditAction[];
  inviteStats: InviteStats;
  pointAdjustmentStats: PointAdjustmentStats;
  adminAuditNextCursor: string | null;
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onUpdateMemberDisplayName: (formData: FormData) => Promise<MemberDisplayNameResult>;
  onPromoteUser: (formData: FormData) => Promise<RoleChangeResult>;
  onRemoveOrgMember: (formData: FormData) => Promise<MemberRemovalResult>;
  onTransferOwnership: (formData: FormData) => Promise<RoleChangeResult>;
  onUpdateOrgSlug: (formData: FormData) => Promise<OrgSettingsMutationResult>;
  onUpdateOrgSettings: (formData: FormData) => Promise<OrgSettingsMutationResult>;
  onArchiveOrganization: (formData: FormData) => Promise<ArchiveOrganizationResult>;
  onLoadAdminAudit: (
    type?: AdminAuditAction["type"],
    cursor?: string,
  ) => Promise<PagedAdminAuditActions>;
  onLoadPointAdjustmentStats: (seasonId?: string) => Promise<PointAdjustmentStats>;
  onCreateInvite: () => Promise<CreateInviteResult>;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

type ManageSectionId = "overview" | "members" | "roles" | "houses" | "seasons" | "settings" | "audit";

const MANAGE_SECTIONS: Array<{
  id: ManageSectionId;
  label: string;
  description: string;
  icon: typeof ChartBar;
  ownerOnly?: boolean;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Point adjustment activity and deduction reporting.",
    icon: ChartBar,
  },
  {
    id: "members",
    label: "Members",
    description: "Invite members, assign houses, and manage access.",
    icon: UsersThree,
  },
  {
    id: "roles",
    label: "Roles",
    description: "Promote members or remove admin access.",
    icon: ShieldCheck,
    ownerOnly: true,
  },
  {
    id: "houses",
    label: "Houses",
    description: "Create and update house details.",
    icon: House,
    ownerOnly: true,
  },
  {
    id: "seasons",
    label: "Seasons",
    description: "Rename seasons or start the next competition window.",
    icon: Calendar,
    ownerOnly: true,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Update organization-level details.",
    icon: Gear,
    ownerOnly: true,
  },
  {
    id: "audit",
    label: "Audit",
    description: "Review the full administrative history.",
    icon: ClipboardText,
  },
];

export function AdminForms({
  users,
  houses,
  seasons,
  activeSeason,
  organization,
  actorRole,
  recentDeletedPoints,
  recentAdminActions,
  inviteStats,
  pointAdjustmentStats,
  adminAuditNextCursor,
  onCreateHouse,
  onAssignHouse,
  onUpdateMemberDisplayName,
  onPromoteUser,
  onRemoveOrgMember,
  onTransferOwnership,
  onUpdateOrgSlug,
  onUpdateOrgSettings,
  onArchiveOrganization,
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

  function handleSectionChange(id: ManageSectionId) {
    const section = MANAGE_SECTIONS.find((s) => s.id === id);
    if (section?.ownerOnly && !isOwner) return;
    setActiveSection(id);
  }

  return (
    <div className="space-y-4">
      {/* Persistent metrics strip */}
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card px-4 py-3">
        <MetricPill icon={<UsersThree size={14} />} label="Members" value={users.length} />
        <MetricPill icon={<House size={14} />} label="Houses" value={houses.length} />
        <MetricPill icon={<UserSwitch size={14} />} label="Unassigned" value={unassignedCount} />
        <MetricPill icon={<Trash size={14} />} label="Deleted pts" value={recentDeletedPoints.length} />
        <MetricPill
          icon={<TrendDown size={14} />}
          label="Deductions"
          value={pointAdjustmentStats.totalDeductionCount}
        />
      </div>

      {/* Sidebar layout */}
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-6">
        {/* Desktop sidebar nav */}
        <aside className="hidden lg:block">
          <nav aria-label="Manage sections">
            <ul className="space-y-1">
              {MANAGE_SECTIONS.map((section) => {
                const isActive = section.id === activeSection;
                const isDisabled = section.ownerOnly === true && !isOwner;
                const Icon = section.icon;

                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-disabled={isDisabled}
                      aria-controls={`manage-section-${section.id}`}
                      id={`manage-tab-${section.id}`}
                      disabled={isDisabled}
                      title={isDisabled ? `${section.label} is owner-only` : undefined}
                      onClick={() => handleSectionChange(section.id)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isDisabled
                            ? "text-muted-foreground opacity-60 cursor-not-allowed"
                            : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 text-sm font-semibold">
                        <Icon size={15} aria-hidden="true" />
                        <span className="flex-1">{section.label}</span>
                        {isDisabled ? (
                          <span className="rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide">
                            Owner only
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Mobile section picker */}
        <div className="lg:hidden">
          <select
            aria-label="Manage sections"
            value={activeSection}
            onChange={(e) => handleSectionChange(e.target.value as ManageSectionId)}
            className="w-full rounded-xl border bg-card px-3 py-2 text-sm font-medium focus:outline-none"
          >
            {MANAGE_SECTIONS.map((section) => {
              const isDisabled = section.ownerOnly === true && !isOwner;
              return (
                <option key={section.id} value={section.id} disabled={isDisabled}>
                  {section.label}{isDisabled ? " (Owner only)" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* Content area */}
        <div
          role="tabpanel"
          id={`manage-section-${activeSection}`}
          aria-labelledby={`manage-tab-${activeSection}`}
        >
          {activeSection === "overview" ? (
            <ManageOverview
              pointAdjustmentStats={pointAdjustmentStats}
              seasons={seasons}
              onLoadPointAdjustmentStats={onLoadPointAdjustmentStats}
            />
          ) : null}

          {activeSection === "members" ? (
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
              onUpdateMemberDisplayName={onUpdateMemberDisplayName}
              onRemoveOrgMember={onRemoveOrgMember}
              onCreateInvite={onCreateInvite}
            />
          ) : null}

          {activeSection === "roles" ? (
            <RoleManagement
              users={users}
              actorRole={actorRole}
              onPromoteUser={onPromoteUser}
            />
          ) : null}

          {activeSection === "settings" ? (
            <OrgSettingsManagement
              users={users}
              organization={organization}
              onTransferOwnership={onTransferOwnership}
              onUpdateOrgSlug={onUpdateOrgSlug}
              onUpdateOrgSettings={onUpdateOrgSettings}
              onArchiveOrganization={onArchiveOrganization}
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
    </div>
  );
}

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-number text-sm font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
