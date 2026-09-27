import type { AppUserOrganizationContext } from "@housepoints/contracts";

export type HousePointsDeepLink =
  | { kind: "dashboard"; organizationSlug: string }
  | { kind: "activity"; organizationSlug: string; pointId: string }
  | { kind: "invite"; token: string };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validSegment(value: string | undefined): value is string {
  return Boolean(value && value.length <= 512);
}

export function parseHousePointsUrl(url: string): HousePointsDeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "housepoints:") return null;

  let segments: string[];
  try {
    segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return null;
  }
  if (parsed.hostname === "o") {
    const [organizationSlug, section, pointId, extra] = segments;
    if (
      !organizationSlug ||
      !SLUG_PATTERN.test(organizationSlug) ||
      extra
    ) {
      return null;
    }
    if (section === "dashboard" && !pointId) {
      return { kind: "dashboard", organizationSlug };
    }
    if (section === "activity" && validSegment(pointId)) {
      return { kind: "activity", organizationSlug, pointId };
    }
  }
  if (parsed.hostname === "invite") {
    const [token, extra] = segments;
    return validSegment(token) && !extra ? { kind: "invite", token } : null;
  }
  return null;
}

export function routeForDeepLink(link: HousePointsDeepLink): string {
  if (link.kind === "dashboard") {
    return `/o/${encodeURIComponent(link.organizationSlug)}/dashboard`;
  }
  if (link.kind === "activity") {
    return `/o/${encodeURIComponent(link.organizationSlug)}/activity/${encodeURIComponent(link.pointId)}`;
  }
  return `/invite/${encodeURIComponent(link.token)}`;
}

export type NotificationMembership = Pick<AppUserOrganizationContext, "organizationId" | "organizationSlug">;

/** Resolve only from notification identity, never from the selected organization. */
export function deepLinkFromNotificationData(
  data: Record<string, unknown>,
  memberships: readonly NotificationMembership[],
): HousePointsDeepLink | null {
  const explicitLink = typeof data.url === "string" ? parseHousePointsUrl(data.url) : null;
  if (data.url !== undefined && !explicitLink) return null;

  if (data.organizationId !== undefined) {
    if (typeof data.organizationId !== "string" || !data.organizationId) return null;
    const membership = memberships.find(item => item.organizationId === data.organizationId);
    if (!membership) return null;
    // Reject conflicting identities instead of following a URL into another tenant.
    if (explicitLink && (explicitLink.kind === "invite" || explicitLink.organizationSlug !== membership.organizationSlug)) return null;
    if (explicitLink) return explicitLink;
    if (data.type === "POINT_AWARD_RECEIVED" || data.type === "POINT_DEDUCTION_RECEIVED") {
      if (typeof data.entityId !== "string" || !validSegment(data.entityId)) return null;
      return { kind: "activity", organizationSlug: membership.organizationSlug, pointId: data.entityId };
    }
    // Reaction entityIds identify reactions, not point transactions.
    return { kind: "dashboard", organizationSlug: membership.organizationSlug };
  }

  // Legacy canonical URLs carry an explicit identity and remain supported.
  if (explicitLink?.kind === "invite") return explicitLink;
  return explicitLink && memberships.some(item => item.organizationSlug === explicitLink.organizationSlug)
    ? explicitLink : null;
}
