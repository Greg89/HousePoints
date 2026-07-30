import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import { useActiveOrg } from "@/context/org-provider";
import { deepLinkFromNotificationData, routeForDeepLink } from "@/lib/deep-links";
import { logger } from "@/lib/logger";

export function NotificationResponseManager() {
  const { activeOrgSlug } = useActiveOrg();
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse) => {
      if (handledResponseId.current === response.notification.request.identifier) return;
      const link = deepLinkFromNotificationData(
        response.notification.request.content.data,
        activeOrgSlug,
      );
      if (!link) {
        if (activeOrgSlug) {
          logger.warn("mobile.notifications.deep_link_invalid");
        }
        return;
      }
      handledResponseId.current = response.notification.request.identifier;
      router.push(routeForDeepLink(link) as never);
      void Notifications.clearLastNotificationResponseAsync();
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handle(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, [activeOrgSlug]);

  return null;
}
