"use client";

import type { DeletedPoint, Season, SeasonTransition, UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
  HouseMutationResult,
  RenameSeasonResult,
  StartSeasonResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";
import { DeletedPointsReport } from "./DeletedPointsReport";
import { HouseManagement } from "./HouseManagement";
import { ManageOverview } from "./ManageOverview";
import { SeasonManagement } from "./SeasonManagement";
import { TeamManagement } from "./TeamManagement";

interface AdminFormsProps {
  users: AdminUser[];
  houses: AdminHouse[];
  seasons: Season[];
  activeSeason: Season;
  actorRole: UserRole;
  recentDeletedPoints: DeletedPoint[];
  onCreateHouse: (formData: FormData) => Promise<HouseMutationResult>;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onCreateInvite: () => Promise<CreateInviteResult>;
  onStartSeason: (formData: FormData) => Promise<StartSeasonResult<SeasonTransition>>;
  onRenameSeason: (formData: FormData) => Promise<RenameSeasonResult<Season>>;
}

export function AdminForms({
  users,
  houses,
  seasons,
  activeSeason,
  actorRole,
  recentDeletedPoints,
  onCreateHouse,
  onAssignHouse,
  onCreateInvite,
  onStartSeason,
  onRenameSeason,
}: AdminFormsProps) {
  const unassignedUsers = users.filter((user) => !user.houseId);
  const assignedUsers = users.filter((user) => user.houseId);
  const unassignedCount = unassignedUsers.length;
  const unassignedSummary =
    unassignedCount === 1 ? "1 needs assignment" : `${unassignedCount} need assignment`;

  return (
    <div className="space-y-6">
      <ManageOverview
        memberCount={users.length}
        houseCount={houses.length}
        unassignedCount={unassignedCount}
        deletedPointCount={recentDeletedPoints.length}
      />

      <DeletedPointsReport recentDeletedPoints={recentDeletedPoints} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <SeasonManagement
            seasons={seasons}
            activeSeason={activeSeason}
            actorRole={actorRole}
            onStartSeason={onStartSeason}
            onRenameSeason={onRenameSeason}
          />
          <HouseManagement
            houses={houses}
            onCreateHouse={onCreateHouse}
          />
        </div>

        <TeamManagement
          users={users}
          houses={houses}
          unassignedUsers={unassignedUsers}
          assignedUsers={assignedUsers}
          unassignedSummary={unassignedSummary}
          onAssignHouse={onAssignHouse}
          onCreateInvite={onCreateInvite}
        />
      </div>
    </div>
  );
}
