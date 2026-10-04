import type { AuthBootstrapStatus } from "./auth-bootstrap";
import type { NotificationMembership } from "./deep-links";

export function organizationDeepLinkState(input: {
  status: AuthBootstrapStatus;
  hydrated: boolean;
  memberships: readonly NotificationMembership[];
  slug: string;
  activeOrgSlug: string | null;
  selectedSlug: string | null;
}): "waiting" | "unavailable" | "selecting" | "ready" {
  if (input.status !== "ready" || !input.hydrated) return "waiting";
  if (!input.memberships.some(item => item.organizationSlug === input.slug)) return "unavailable";
  return input.activeOrgSlug === input.slug && input.selectedSlug === input.slug ? "ready" : "selecting";
}
