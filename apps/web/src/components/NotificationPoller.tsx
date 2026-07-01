"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Notification, PagedNotifications } from "@housepoints/contracts";

export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;

type NotificationPollerProps = {
  notifications: PagedNotifications;
  onNotificationsChange: (notifications: PagedNotifications) => void;
  onRefreshNotifications: () => Promise<PagedNotifications>;
  pollIntervalMs?: number;
};

export function NotificationPoller({
  notifications,
  onNotificationsChange,
  onRefreshNotifications,
  pollIntervalMs = NOTIFICATION_POLL_INTERVAL_MS,
}: NotificationPollerProps) {
  const router = useRouter();
  const seenUnreadIds = useRef(new Set(getUnreadNotificationIds(notifications)));

  useEffect(() => {
    let active = true;

    async function pollNotifications() {
      try {
        const nextNotifications = await onRefreshNotifications();

        if (!active) {
          return;
        }

        showNewActionRequiredToasts(nextNotifications, seenUnreadIds.current, router.push);
        onNotificationsChange(nextNotifications);
      } catch {
        // Polling is only a lightweight active-session cue. Durable notifications
        // are still loaded on the next dashboard render or account menu refresh.
      }
    }

    const intervalId = window.setInterval(() => {
      void pollNotifications();
    }, pollIntervalMs);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [onNotificationsChange, onRefreshNotifications, pollIntervalMs, router.push]);

  return null;
}

function showNewActionRequiredToasts(
  notifications: PagedNotifications,
  seenUnreadIds: Set<string>,
  navigate: (href: string) => void,
) {
  const newActionRequiredNotifications = notifications.items.filter((notification) => {
    if (notification.readAt || notification.severity !== "ACTION_REQUIRED") {
      return false;
    }

    return !seenUnreadIds.has(notification.id);
  });

  for (const notification of notifications.items) {
    if (!notification.readAt) {
      seenUnreadIds.add(notification.id);
    }
  }

  if (newActionRequiredNotifications.length === 0) {
    return;
  }

  if (newActionRequiredNotifications.length === 1) {
    const [notification] = newActionRequiredNotifications;
    const actionHref = getSafeInternalHref(notification.actionHref);

    toast(notification.title, {
      description: notification.body,
      ...(actionHref && notification.actionLabel
        ? {
            action: {
              label: notification.actionLabel,
              onClick: () => navigate(actionHref),
            },
          }
        : {}),
    });
    return;
  }

  toast("New notifications need attention", {
    description: `${newActionRequiredNotifications.length} action-required notifications are waiting for you.`,
  });
}

function getUnreadNotificationIds(notifications: PagedNotifications) {
  return notifications.items
    .filter((notification) => !notification.readAt)
    .map((notification) => notification.id);
}

function getSafeInternalHref(href: Notification["actionHref"]) {
  if (!href?.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  return href;
}
