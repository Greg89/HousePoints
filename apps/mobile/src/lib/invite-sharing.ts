import type { InviteLink } from "@housepoints/contracts";

export function buildInviteUrl(webBaseUrl: string, joinPath: string): string {
  const base = webBaseUrl.replace(/\/+$/, "");
  const path = joinPath.startsWith("/") ? joinPath : `/${joinPath}`;
  return `${base}${path}`;
}

export function buildInviteShareMessage(
  organizationName: string,
  inviteUrl: string,
): string {
  return `Join ${organizationName} on HousePoints:\n${inviteUrl}`;
}

export function formatInviteExpiration(
  expiresAt: InviteLink["expiresAt"],
): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));
}

