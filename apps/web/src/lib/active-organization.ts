import "server-only";

import { cookies } from "next/headers";

export const ACTIVE_ORGANIZATION_COOKIE = "housepoints.activeOrganizationSlug";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$|^[a-z0-9]$/;

export function isValidOrganizationSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export async function readActiveOrganizationSlug(): Promise<string | null> {
  const value = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  return value && isValidOrganizationSlug(value) ? value : null;
}
