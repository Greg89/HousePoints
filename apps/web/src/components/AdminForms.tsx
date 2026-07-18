"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  ChartBar,
  ClipboardText,
  Buildings,
  House,
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
import { ManageAudit } from "./ManageAudit";
import { OrgSettingsManagement } from "./OrgSettingsManagement";
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

type ManageSectionId = "overview" | "members" | "houses" | "seasons" | "organization" | "audit";
type ReadableSearchParams = Pick<URLSearchParams, "get" | "toString">;

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
    description: "Organization attention, status, and recent administration.",
    icon: ChartBar,
  },
  {
    id: "members",
    label: "Members",
    description: "Invite members, assign houses, and manage access.",
    icon: UsersThree,
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
    id: "organization",
    label: "Organization",
    description: "Manage organization identity, URL, ownership, and lifecycle.",
    icon: Buildings,
    ownerOnly: true,
  },
  {
    id: "audit",
    label: "Audit",
    description: "Review the full administrative history.",
    icon: ClipboardText,
  },
];

function getManageSectionFromSearchParams(
  searchParams: ReadableSearchParams,
  isOwner: boolean,
): ManageSectionId | null {
  const requestedSection = searchParams.get("manage");
  const section = MANAGE_SECTIONS.find(({ id }) => id === requestedSection);

  if (!section || (section.ownerOnly && !isOwner)) {
    return null;
  }

  return section.id;
}

function syncManageSectionToUrl(
  section: ManageSectionId,
  searchParams: ReadableSearchParams,
  options?: { memberStatus?: "unassigned" },
): string {
  const nextParams = new URLSearchParams(searchParams.toString());

  if (section === "overview") {
    nextParams.delete("manage");
  } else {
    nextParams.set("manage", section);
  }
  if (section === "members" && options?.memberStatus) {
    nextParams.set("memberStatus", options.memberStatus);
  } else {
    nextParams.delete("memberStatus");
  }

  const nextQuery = nextParams.toString();
  const nextUrl = nextQuery ? `?${nextQuery}` : window.location.pathname;
  window.history.pushState(null, "", nextUrl);
  return nextQuery;
}

export function AdminForms({
  users,
  houses,
  seasons,
  activeSeason,
  organization,
  actorRole,
  recentAdminActions,
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
  const searchParams = useSearchParams();
  const isOwner = actorRole === "OWNER";
  const manageQuery = searchParams.toString();
  const urlSection =
    getManageSectionFromSearchParams(searchParams, isOwner) ?? "overview";
  const [selection, setSelection] = useState<{
    query: string;
    section: ManageSectionId;
  }>(() => ({
    query: manageQuery,
    section: urlSection,
  }));
  const selectedSectionDefinition = MANAGE_SECTIONS.find(
    ({ id }) => id === selection.section,
  );
  const canUseSelectedSection =
    selectedSectionDefinition && (!selectedSectionDefinition.ownerOnly || isOwner);
  const activeSection =
    selection.query === manageQuery && canUseSelectedSection
      ? selection.section
      : urlSection;
  function handleSectionChange(
    id: ManageSectionId,
    options?: { memberStatus?: "unassigned" },
  ) {
    const section = MANAGE_SECTIONS.find((s) => s.id === id);
    if (section?.ownerOnly && !isOwner) return;
    const nextQuery = syncManageSectionToUrl(id, searchParams, options);
    setSelection({ query: nextQuery, section: id });
  }

  return (
    <div className="space-y-4">
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
              users={users}
              houses={houses}
              activeSeason={activeSeason}
              actorRole={actorRole}
              recentAdminActions={recentAdminActions}
              onNavigate={(section, options) => handleSectionChange(section, options)}
            />
          ) : null}

          {activeSection === "members" ? (
            <TeamManagement
              users={users}
              houses={houses}
              actorRole={actorRole}
              onAssignHouse={onAssignHouse}
              onUpdateMemberDisplayName={onUpdateMemberDisplayName}
              onPromoteUser={onPromoteUser}
              onRemoveOrgMember={onRemoveOrgMember}
              onCreateInvite={onCreateInvite}
            />
          ) : null}

          {activeSection === "organization" ? (
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
            <ManageAudit
              actions={recentAdminActions}
              nextCursor={adminAuditNextCursor}
              onLoadPage={onLoadAdminAudit}
              pointAdjustmentStats={pointAdjustmentStats}
              seasons={seasons}
              onLoadPointAdjustmentStats={onLoadPointAdjustmentStats}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
