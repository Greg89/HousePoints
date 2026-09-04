export function slugifyOrganizationName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ParsedInviteInput = {
  inviteToken: string;
  organizationSlug?: string;
};

/** Accept raw tokens, web invite URLs, and housepoints:// invite deep links. */
export function parseInviteInput(value: string): ParsedInviteInput | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);

    if (url.protocol === "housepoints:" && url.hostname === "invite") {
      const inviteToken = segments[0];
      return inviteToken ? { inviteToken: decodeURIComponent(inviteToken) } : null;
    }

    const joinIndex = segments.lastIndexOf("join");
    const inviteToken = joinIndex >= 0 ? segments[joinIndex + 1] : undefined;
    const organizationSlug =
      joinIndex >= 2 && segments[joinIndex - 2] === "o"
        ? segments[joinIndex - 1]
        : undefined;

    if (inviteToken) {
      return organizationSlug
        ? {
            inviteToken: decodeURIComponent(inviteToken),
            organizationSlug: decodeURIComponent(organizationSlug),
          }
        : { inviteToken: decodeURIComponent(inviteToken) };
    }
  } catch {
    // A raw token is expected not to parse as a URL.
  }

  return { inviteToken: trimmed };
}
