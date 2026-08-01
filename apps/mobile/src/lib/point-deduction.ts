import type { OrgMember } from "@housepoints/contracts";

export const DEDUCTION_AMOUNT = 10;
export const DEDUCTION_REASON_MIN = 3;
export const DEDUCTION_REASON_MAX = 240;

export function eligibleDeductionMembers(
  members: OrgMember[],
  actorHouseId: string | null,
  search = "",
): OrgMember[] {
  if (!actorHouseId) {
    return [];
  }

  const term = search.trim().toLowerCase();
  return members
    .filter(
      (member) =>
        member.houseId !== null &&
        member.houseId !== actorHouseId &&
        (!term || member.displayName.toLowerCase().includes(term)),
    )
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function pointDeductionErrorMessage(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case "DEDUCTION_COOLDOWN_ACTIVE":
      return "Your house has already deducted points in the last 24 hours.";
    case "TARGET_DEDUCTION_LIMIT_ACTIVE":
      return "This member has already received a deduction in the last 24 hours.";
    case "ACTOR_HOUSE_REQUIRED":
      return "You must be assigned to a house before deducting points.";
    case "ACTIVE_SEASON_REQUIRED":
      return "An active season is required before deducting points.";
    case "POINT_ADJUSTMENTS_DISABLED":
      return "Point deductions are not enabled for this environment.";
    default:
      return fallback;
  }
}

