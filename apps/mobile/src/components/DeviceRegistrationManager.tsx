import { useEffect, useRef } from "react";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { registerCurrentDevice } from "@/lib/device-registration";
import { logger, serializeError } from "@/lib/logger";
import { updateRegistrationAttempt } from "./device-registration-manager-core";

export function DeviceRegistrationManager() {
  const { status, user, getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const attemptedKey = useRef<string | null>(null);

  useEffect(() => {
    const registrationKey = status === "ready" && user && activeOrgSlug
      ? `${user.id}:${activeOrgSlug}`
      : null;
    const attempt = updateRegistrationAttempt(attemptedKey.current, registrationKey);
    attemptedKey.current = attempt.attemptedKey;
    if (!attempt.shouldRegister || !activeOrgSlug) return;

    void (async () => {
      try {
        const accessToken = await getAccessToken();
        await registerCurrentDevice({
          accessToken,
          organizationSlug: activeOrgSlug,
          requestPermission: false,
        });
      } catch (err) {
        attemptedKey.current = null;
        logger.warn("mobile.devices.register_failed", serializeError(err));
      }
    })();
  }, [activeOrgSlug, getAccessToken, status, user]);

  return null;
}
