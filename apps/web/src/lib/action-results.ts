export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type AwardPointsResult = MutationResult;
export type HouseMutationResult = MutationResult;
export type ProfileUpdateResult = MutationResult;
export type CreateInviteResult =
  | { ok: true; token: string; expiresAt: string }
  | Extract<MutationResult, { ok: false }>;
