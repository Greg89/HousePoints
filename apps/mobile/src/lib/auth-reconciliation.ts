import type { AppUserOrganizationContext } from "@housepoints/contracts";
import type { AppStateStatus } from "react-native";

export const AUTH_RECONCILIATION_BACKGROUND_MS = 60_000;

export function shouldReconcileAuthOnAppState(input: {
  nextStatus: AppStateStatus;
  status: "initializing" | "signedOut" | "bootstrapping" | "ready" | "error";
  hasUser: boolean;
  backgroundedAt: number | null;
  now: number;
}): boolean {
  return input.nextStatus === "active" &&
    input.status === "ready" &&
    input.hasUser &&
    input.backgroundedAt !== null &&
    input.now - input.backgroundedAt >= AUTH_RECONCILIATION_BACKGROUND_MS;
}

export function reconcileActiveOrgSlug(
  activeSlug: string | null,
  memberships: readonly AppUserOrganizationContext[],
): string | null {
  if (activeSlug && memberships.some((item) => item.organizationSlug === activeSlug)) {
    return activeSlug;
  }
  if (memberships.length === 1) {
    return memberships[0]?.organizationSlug ?? null;
  }
  if (activeSlug) {
    return null;
  }
  return memberships.find((item) => item.isCurrent)?.organizationSlug ?? null;
}
