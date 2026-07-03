export function pickPreferredMembership<T extends { organizationId: string }>(
  memberships: T[] | null | undefined,
  legacyOrganizationId: string | null | undefined,
): T | null {
  const activeMemberships = memberships ?? [];
  return activeMemberships.find(
    (membership) => membership.organizationId === legacyOrganizationId,
  ) ?? activeMemberships[0] ?? null;
}
