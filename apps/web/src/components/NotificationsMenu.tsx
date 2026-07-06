"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, Bell, Check } from "@phosphor-icons/react";
import type { Notification, PagedNotifications } from "@housepoints/contracts";
import type { NotificationMutationResult } from "@/lib/action-results";
import { cn } from "@/lib/cn";

type NotificationsMenuProps = {
  notifications: PagedNotifications;
  onNotificationsChange: (notifications: PagedNotifications) => void;
  onMarkNotificationRead: (notificationId: string) => Promise<NotificationMutationResult>;
  onMarkAllNotificationsRead: () => Promise<NotificationMutationResult>;
  dashboardHref: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function NotificationsMenu({
  notifications,
  onNotificationsChange,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  dashboardHref,
}: NotificationsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showRead, setShowRead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const displayedUnreadCount = Math.min(notifications.unreadCount, 99);
  const hasUnread = notifications.unreadCount > 0;
  const orderedNotifications = getOrderedNotifications(notifications.items);
  const unreadNotifications = orderedNotifications.filter((notification) => !notification.readAt);
  const readNotifications = orderedNotifications.filter((notification) => Boolean(notification.readAt));
  const showReadSection = showRead || unreadNotifications.length === 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowRead(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setShowRead(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function markLocalRead(notificationIds: string[]) {
    const unreadIds = new Set(
      notifications.items
        .filter((item) => notificationIds.includes(item.id) && !item.readAt)
        .map((item) => item.id),
    );

    if (unreadIds.size === 0) {
      return;
    }

    onNotificationsChange({
      ...notifications,
      items: notifications.items.map((item) =>
        unreadIds.has(item.id)
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
      unreadCount: Math.max(0, notifications.unreadCount - unreadIds.size),
    });
  }

  async function markNotificationLocally(notificationId: string) {
    const result = await onMarkNotificationRead(notificationId);

    if (result.ok) {
      markLocalRead([notificationId]);
      return true;
    }

    setError(result.message);
    return false;
  }

  function handleMarkRead(notificationId: string) {
    setError(null);

    startTransition(async () => {
      await markNotificationLocally(notificationId);
    });
  }

  function handleOpenAction(notification: Notification, href: string) {
    setError(null);

    startTransition(async () => {
      const canNavigate = notification.readAt ? true : await markNotificationLocally(notification.id);

      if (canNavigate) {
        setOpen(false);
        if (isExternalHttpsHref(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }

        router.push(href);
      }
    });
  }

  function handleMarkAllRead() {
    setError(null);

    startTransition(async () => {
      const result = await onMarkAllNotificationsRead();

      if (result.ok) {
        const unreadIds = notifications.items.filter((item) => !item.readAt).map((item) => item.id);
        markLocalRead(unreadIds);
        return;
      }

      setError(result.message);
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={
          hasUnread
            ? `Notifications menu, ${notifications.unreadCount} unread notifications`
            : "Notifications menu"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Bell weight={hasUnread ? "fill" : "regular"} size={17} aria-hidden="true" />
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
            {displayedUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-3 flex max-h-[calc(100dvh-7rem)] w-[min(calc(100vw-2rem),24rem)] flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/10"
        >
          <section className="p-3" aria-label="Notifications feed">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-bold">Notifications</h2>
                <p className="text-xs text-muted-foreground">
                  {hasUnread ? `${notifications.unreadCount} unread` : "All caught up"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={!hasUnread || isPending}
                className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all read
              </button>
            </div>

            {error ? (
              <p className="mb-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            {notifications.items.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <Check size={24} className="mx-auto text-primary" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold">You&apos;re all caught up.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notifications that need attention will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {unreadNotifications.length > 0 ? (
                  <section aria-label="Unread notifications" className="space-y-2">
                    <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Unread
                    </p>
                    {unreadNotifications.map((notification) => (
                      <NotificationCard
                        key={notification.id}
                        notification={notification}
                        dashboardHref={dashboardHref}
                        disabled={isPending}
                        onMarkRead={handleMarkRead}
                        onOpenAction={handleOpenAction}
                      />
                    ))}
                  </section>
                ) : null}

                {readNotifications.length > 0 ? (
                  <section aria-label="Read notifications" className="space-y-2">
                    {unreadNotifications.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowRead((current) => !current)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {showReadSection
                          ? `Hide read (${readNotifications.length})`
                          : `Show read (${readNotifications.length})`}
                      </button>
                    ) : (
                      <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Recent read
                      </p>
                    )}

                    {showReadSection ? (
                      <div className="space-y-2">
                        {readNotifications.map((notification) => (
                          <NotificationCard
                            key={notification.id}
                            notification={notification}
                            dashboardHref={dashboardHref}
                            disabled={isPending}
                            onMarkRead={handleMarkRead}
                            onOpenAction={handleOpenAction}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function getOrderedNotifications(notifications: Notification[]) {
  return [...notifications].sort((left, right) => {
    const leftUnreadPriority = left.readAt ? 1 : 0;
    const rightUnreadPriority = right.readAt ? 1 : 0;

    if (leftUnreadPriority !== rightUnreadPriority) {
      return leftUnreadPriority - rightUnreadPriority;
    }

    const leftSeverityPriority = left.severity === "ACTION_REQUIRED" ? 0 : 1;
    const rightSeverityPriority = right.severity === "ACTION_REQUIRED" ? 0 : 1;

    if (leftSeverityPriority !== rightSeverityPriority) {
      return leftSeverityPriority - rightSeverityPriority;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function NotificationCard({
  notification,
  dashboardHref,
  disabled,
  onMarkRead,
  onOpenAction,
}: {
  notification: Notification;
  dashboardHref: string;
  disabled: boolean;
  onMarkRead: (notificationId: string) => void;
  onOpenAction: (notification: Notification, href: string) => void;
}) {
  const unread = !notification.readAt;
  const actionHref = getSafeActionHref(notification.actionHref, dashboardHref);
  const isExternalAction = Boolean(actionHref && isExternalHttpsHref(actionHref));

  return (
    <article
      className={cn(
        "rounded-xl border p-3 text-sm transition-colors",
        unread ? "bg-primary/5" : "bg-background/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread notification" /> : null}
            <h3 className="font-semibold leading-snug">{notification.title}</h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
        </div>
        <time
          dateTime={notification.createdAt}
          className="shrink-0 whitespace-nowrap text-[11px] font-medium text-muted-foreground"
        >
          {dateFormatter.format(new Date(notification.createdAt))}
        </time>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {actionHref && notification.actionLabel ? (
          <button
            type="button"
            onClick={() => onOpenAction(notification, actionHref)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {notification.actionLabel}
            {isExternalAction ? <ArrowSquareOut size={12} aria-hidden="true" /> : null}
          </button>
        ) : null}
        {unread ? (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            disabled={disabled}
            className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-60"
          >
            Mark read
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Check size={12} aria-hidden="true" />
            Read
          </span>
        )}
        {notification.severity === "ACTION_REQUIRED" ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Action required
          </span>
        ) : null}
      </div>
    </article>
  );
}

function getSafeActionHref(href: string | null, dashboardHref: string) {
  if (!href?.startsWith("/") || href.startsWith("//")) {
    return isExternalHttpsHref(href) ? href : null;
  }

  if (href === "/") {
    return dashboardHref;
  }

  if (href.startsWith("/?")) {
    return `${dashboardHref}${href.slice(1)}`;
  }

  return href;
}

function isExternalHttpsHref(href: string | null) {
  if (!href) {
    return false;
  }

  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}
