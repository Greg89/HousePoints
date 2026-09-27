import * as Notifications from "expo-notifications";
import { router, useSegments, useRootNavigationState } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { logger, serializeError } from "@/lib/logger";
import { createNotificationResponseQueue } from "./notification-response-manager-core";

export function NotificationResponseManager() {
  const { status } = useAppAuth();
  const { hydrated, memberships, activeMembership } = useActiveOrg();
  const navigation = useRootNavigationState();
  const firstSegment = useSegments()[0] as string | undefined;
  const queue = useRef(createNotificationResponseQueue());
  const [version, setVersion] = useState(0);
  // Let the index/login/picker redirects finish before handing a tap to a route.
  const navigationReady = Boolean(navigation?.key) && Boolean(firstSegment) && firstSegment !== "index" && firstSegment !== "login"
    && !(firstSegment === "pick-org" && activeMembership);

  useEffect(() => {
    let cancelled = false;
    let receivedLiveResponse = false;
    const enqueue = (response: Notifications.NotificationResponse) => {
      if (cancelled) return;
      queue.current.enqueue({ id: response.notification.request.identifier, data: response.notification.request.content.data });
      setVersion(value => value + 1);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      receivedLiveResponse = true;
      enqueue(response);
    });
    void Notifications.getLastNotificationResponseAsync().then(response => {
      // An older asynchronous cold-start read must not override a newer live tap.
      if (response && !receivedLiveResponse) enqueue(response);
    }).catch(error => logger.warn("mobile.notifications.response_read_failed", serializeError(error)));
    return () => { cancelled = true; subscription.remove(); };
  }, []);

  useEffect(() => {
    void queue.current.drain({ status, hydrated, navigationReady, memberships }, {
      navigate: route => router.push(route as never),
      acknowledge: async id => {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last?.notification.request.identifier === id) {
          await Notifications.clearLastNotificationResponseAsync();
        }
      },
      failed: error => logger.warn("mobile.notifications.routing_failed", serializeError(error)),
    });
    return () => queue.current.pause();
  }, [status, hydrated, navigationReady, memberships, version]);

  return null;
}
