import type { AppUserOrganizationContext } from "@housepoints/contracts";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { logger, serializeError } from "@/lib/logger";
import {
  clearStoredActiveOrgSlug,
  getStoredActiveOrgSlug,
  persistActiveOrgSlug,
} from "@/lib/secure-store";

import { useAppAuth } from "./auth-provider";

/**
 * Active-organization state for the mobile app.
 *
 * The persisted `activeOrgSlug` lives in `expo-secure-store` so it survives
 * app restarts alongside credentials. Whenever the `AppUser` returned by
 * `/users/bootstrap` changes, we reconcile the persisted slug against the
 * available memberships and auto-select when there is exactly one choice.
 */

type OrgContextValue = {
  activeOrgSlug: string | null;
  activeMembership: AppUserOrganizationContext | null;
  memberships: AppUserOrganizationContext[];
  needsPicker: boolean;
  hydrated: boolean;
  selectOrg: (slug: string) => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAppAuth();
  const [activeOrgSlug, setActiveOrgSlug] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const memberships = useMemo<AppUserOrganizationContext[]>(
    () => user?.organizationContexts ?? [],
    [user],
  );

  // Hydrate persisted slug once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await getStoredActiveOrgSlug();
        if (!cancelled) {
          setActiveOrgSlug(stored);
        }
      } catch (err) {
        logger.warn("mobile.org.hydrate_failed", serializeError(err));
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile active slug whenever memberships change.
  useEffect(() => {
    if (!hydrated || status !== "ready") {
      return;
    }

    if (memberships.length === 0) {
      if (activeOrgSlug !== null) {
        setActiveOrgSlug(null);
        void clearStoredActiveOrgSlug();
      }
      return;
    }

    // If the persisted slug is not in memberships, clear it and let the picker
    // handle the ambiguous state.
    if (
      activeOrgSlug &&
      !memberships.some((m) => m.organizationSlug === activeOrgSlug)
    ) {
      setActiveOrgSlug(null);
      void clearStoredActiveOrgSlug();
      return;
    }

    // Auto-select the only membership.
    if (!activeOrgSlug && memberships.length === 1) {
      const only = memberships[0];
      if (only) {
        setActiveOrgSlug(only.organizationSlug);
        void persistActiveOrgSlug(only.organizationSlug);
      }
      return;
    }

    // Prefer the server-side "current" membership if nothing is persisted.
    if (!activeOrgSlug) {
      const current = memberships.find((m) => m.isCurrent);
      if (current) {
        setActiveOrgSlug(current.organizationSlug);
        void persistActiveOrgSlug(current.organizationSlug);
      }
    }
  }, [hydrated, status, activeOrgSlug, memberships]);

  const selectOrg = useCallback(async (slug: string) => {
    setActiveOrgSlug(slug);
    await persistActiveOrgSlug(slug);
    logger.info("mobile.org.selected", { slug });
  }, []);

  const activeMembership = useMemo<AppUserOrganizationContext | null>(
    () =>
      memberships.find((m) => m.organizationSlug === activeOrgSlug) ?? null,
    [memberships, activeOrgSlug],
  );

  const needsPicker =
    status === "ready" && memberships.length > 1 && activeOrgSlug === null;

  const value = useMemo<OrgContextValue>(
    () => ({
      activeOrgSlug,
      activeMembership,
      memberships,
      needsPicker,
      hydrated,
      selectOrg,
    }),
    [
      activeOrgSlug,
      activeMembership,
      memberships,
      needsPicker,
      hydrated,
      selectOrg,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useActiveOrg(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) {
    throw new Error("useActiveOrg must be used within an OrgProvider");
  }
  return value;
}
