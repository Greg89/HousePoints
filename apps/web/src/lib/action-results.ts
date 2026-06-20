export type MutationResult =
  | { ok: true }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type AwardPointsResult = MutationResult;
export type ProfileUpdateResult = MutationResult;
