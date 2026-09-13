import type { AppUserOrganizationContext } from "@housepoints/contracts";
import { describe, expect, it } from "vitest";

import {
  AUTH_RECONCILIATION_BACKGROUND_MS,
  reconcileActiveOrgSlug,
  shouldReconcileAuthOnAppState,
} from "./auth-reconciliation";

const membership = (slug: string, isCurrent = false): AppUserOrganizationContext => ({
  organizationId: `${slug}-id`, organizationSlug: slug, organizationName: slug,
  role: "MEMBER", houseId: null, houseName: null, houseColor: null, isCurrent,
});

describe("auth foreground reconciliation", () => {
  it("refreshes a ready account after a meaningful background absence", () => {
    expect(shouldReconcileAuthOnAppState({ nextStatus: "active", status: "ready", hasUser: true, backgroundedAt: 1_000, now: 1_000 + AUTH_RECONCILIATION_BACKGROUND_MS })).toBe(true);
  });

  it("ignores short absences and non-ready sessions", () => {
    expect(shouldReconcileAuthOnAppState({ nextStatus: "active", status: "ready", hasUser: true, backgroundedAt: 1_000, now: 2_000 })).toBe(false);
    expect(shouldReconcileAuthOnAppState({ nextStatus: "active", status: "bootstrapping", hasUser: true, backgroundedAt: 1_000, now: 1_000 + AUTH_RECONCILIATION_BACKGROUND_MS })).toBe(false);
  });
});

describe("active organization reconciliation", () => {
  it("keeps a membership that is still valid", () => {
    expect(reconcileActiveOrgSlug("alpha", [membership("alpha"), membership("beta")])).toBe("alpha");
  });

  it("moves directly to the only remaining membership", () => {
    expect(reconcileActiveOrgSlug("removed", [membership("alpha")])).toBe("alpha");
  });

  it("requires a choice when removed access leaves multiple memberships", () => {
    expect(reconcileActiveOrgSlug("removed", [membership("alpha"), membership("beta")])).toBeNull();
  });

  it("uses the server preference when no local organization is selected", () => {
    expect(reconcileActiveOrgSlug(null, [membership("alpha"), membership("beta", true)])).toBe("beta");
  });
});
