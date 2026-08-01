import { useEffect, useRef } from "react";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { registerCurrentDevice } from "@/lib/device-registration";
import { logger, serializeError } from "@/lib/logger";

export function DeviceRegistrationManager() {
  const { status, user, getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const attemptedKey = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "ready" || !user || !activeOrgSlug) return;

    const registrationKey = `${user.id}:${activeOrgSlug}`;
    if (attemptedKey.current === registrationKey) return;
    attemptedKey.current = registrationKey;

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        await registerCurrentDevice({ accessToken, organizationSlug: activeOrgSlug });
      } catch (err) {
        attemptedKey.current = null;
        logger.warn("mobile.devices.register_failed", serializeError(err));
      }
    })();
  }, [activeOrgSlug, getAccessToken, status, user]);

  return null;
}

