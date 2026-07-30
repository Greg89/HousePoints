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

export function deepLinkFromNotificationData(
  data: Record<string, unknown>,
  activeOrgSlug: string | null,
): HousePointsDeepLink | null {
  if (typeof data.url === "string") {
    return parseHousePointsUrl(data.url);
  }
  if (!activeOrgSlug) return null;
  if (
    typeof data.entityId === "string" &&
    (data.type === "POINT_AWARD_RECEIVED" ||
      data.type === "POINT_DEDUCTION_RECEIVED")
  ) {
    return {
      kind: "activity",
      organizationSlug: activeOrgSlug,
      pointId: data.entityId,
    };
  }
  return { kind: "dashboard", organizationSlug: activeOrgSlug };
}
