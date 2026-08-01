export type MobileAdminRole = "MEMBER" | "ADMIN" | "OWNER";

export function canAccessMobileAdmin(
  enabled: boolean,
  role: MobileAdminRole | null | undefined,
): boolean {
  return enabled && (role === "ADMIN" || role === "OWNER");
}

export function buildWebAdminUrl(webBaseUrl: string, organizationSlug: string): string {
  const base = webBaseUrl.replace(/\/+$/, "");
  return `${base}/o/${encodeURIComponent(organizationSlug)}?tab=manage`;
}

