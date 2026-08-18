import type { OrgMember } from "@housepoints/contracts";

/** Members who can receive a standard award, ordered for a dropdown list. */
export function eligibleAwardMembers(
  members: OrgMember[] | undefined,
  currentUserId: string | undefined,
): OrgMember[] {
  if (!members) return [];

  return members
    .filter(
      (member) => member.houseId !== null && member.id !== currentUserId,
    )
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: "base",
      }),
    );
}
