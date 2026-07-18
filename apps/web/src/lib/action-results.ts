export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type AwardPointsResult = MutationResult;
export type ArchiveOrganizationResult =
  | { ok: true; redirectTo: string }
  | Extract<MutationResult, { ok: false }>;
export type CreateOrgResult =
  | { ok: true; redirectTo: string }
  | Extract<MutationResult, { ok: false }>;
export type DeletePointResult = MutationResult;
export type DeductPointsResult = MutationResult;
export type PointReactionResult<PointReactionResponse> =
  | { ok: true; reaction: PointReactionResponse }
  | Extract<MutationResult, { ok: false }>;
export type PointReactionDetailsResult<PointReactionDetailsResponse> =
  | { ok: true; details: PointReactionDetailsResponse }
  | Extract<MutationResult, { ok: false }>;
export type HouseAssignmentResult = MutationResult;
export type HouseMutationResult = MutationResult;
export type JoinOrgResult = MutationResult;
export type MemberRemovalResult = MutationResult;
export type MemberDisplayNameResult = MutationResult;
export type OrgSettingsMutationResult = MutationResult;
export type ProfileUpdateResult = MutationResult;
export type RoleChangeResult = MutationResult;
export type NotificationMutationResult =
  | { ok: true; updatedCount: number }
  | Extract<MutationResult, { ok: false }>;
export type RenameSeasonResult<Season> =
  | { ok: true; season: Season }
  | Extract<MutationResult, { ok: false }>;
export type StartSeasonResult<SeasonTransition> =
  | { ok: true; transition: SeasonTransition }
  | Extract<MutationResult, { ok: false }>;
export type CreateInviteResult =
  | { ok: true; token: string; joinPath: string; expiresAt: string }
  | Extract<MutationResult, { ok: false }>;
