export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type AwardPointsResult = MutationResult;
export type CreateOrgResult = MutationResult;
export type DeletePointResult = MutationResult;
export type HouseAssignmentResult = MutationResult;
export type HouseMutationResult = MutationResult;
export type JoinOrgResult = MutationResult;
export type ProfileUpdateResult = MutationResult;
export type RoleChangeResult = MutationResult;
export type RenameSeasonResult<Season> =
  | { ok: true; season: Season }
  | Extract<MutationResult, { ok: false }>;
export type StartSeasonResult<SeasonTransition> =
  | { ok: true; transition: SeasonTransition }
  | Extract<MutationResult, { ok: false }>;
export type CreateInviteResult =
  | { ok: true; token: string; expiresAt: string }
  | Extract<MutationResult, { ok: false }>;
