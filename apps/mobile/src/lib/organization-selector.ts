import type { AppUserOrganizationContext } from "@housepoints/contracts";

export type OrganizationOption = {
  membership: AppUserOrganizationContext;
  selected: boolean;
};

export function organizationOptions(
  memberships: AppUserOrganizationContext[],
  activeOrgSlug: string | null,
): OrganizationOption[] {
  return memberships.map((membership) => ({
    membership,
    selected: membership.organizationSlug === activeOrgSlug,
  }));
}
