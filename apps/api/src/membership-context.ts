export function pickPreferredMembership<T extends { organizationId: string }>(
  memberships: T[] | null | undefined,
): T | null {
  const activeMemberships = memberships ?? [];
  return activeMemberships[0] ?? null;
}
