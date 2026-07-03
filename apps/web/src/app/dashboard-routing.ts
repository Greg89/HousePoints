type RootRedirectSession = {
  isAuthenticated: boolean;
  organizationSlug?: string | null;
  needsOrg?: boolean;
  needsHouseAssignment?: boolean;
};

export function getRootOrganizationRedirect(
  route: string,
  session: RootRedirectSession,
): string | null {
  if (
    route !== "/" ||
    !session.isAuthenticated ||
    session.needsOrg ||
    session.needsHouseAssignment ||
    !session.organizationSlug
  ) {
    return null;
  }

  return `/o/${encodeURIComponent(session.organizationSlug)}`;
}
