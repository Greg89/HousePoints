import type { AppUserOrganizationContext } from "@housepoints/contracts";

type RootRedirectSession = {
  isAuthenticated: boolean;
  organizationSlug?: string | null;
  organizationContexts?: AppUserOrganizationContext[];
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
    session.needsHouseAssignment
  ) {
    return null;
  }

  const organizationSlug =
    session.organizationContexts?.find((context) => context.isCurrent)?.organizationSlug ??
    session.organizationContexts?.[0]?.organizationSlug ??
    session.organizationSlug;

  if (!organizationSlug) {
    return null;
  }

  return `/o/${encodeURIComponent(organizationSlug)}`;
}
