"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Gear,
  SignOut,
  User,
} from "@phosphor-icons/react";
import type { Notification, PagedNotifications } from "@housepoints/contracts";
import type { NotificationMutationResult } from "@/lib/action-results";
import { cn } from "@/lib/cn";

type AccountMenuProps = {
  session: {
    userName: string;
    role: "MEMBER" | "ADMIN" | "OWNER";
  };
  notifications: PagedNotifications;
  onNotificationsChange: (notifications: PagedNotifications) => void;
  onMarkNotificationRead: (notificationId: string) => Promise<NotificationMutationResult>;
  onMarkAllNotificationsRead: () => Promise<NotificationMutationResult>;
  logoutUrl: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function AccountMenu({
  session,
  notifications,
  onNotificationsChange,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  logoutUrl,
}: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const displayedUnreadCount = Math.min(notifications.unreadCount, 99);
  const hasUnread = notifications.unreadCount > 0;

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
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
      const canNavigate = notification.readAt
        ? true
        : await markNotificationLocally(notification.id);

      if (canNavigate) {
        setOpen(false);
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
            ? `Account menu, ${notifications.unreadCount} unread notifications`
            : "Account menu"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {hasUnread ? (
          <Bell weight="fill" size={17} aria-hidden="true" />
        ) : (
          <User size={17} aria-hidden="true" />
        )}
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-destructive-foreground">
            {displayedUnreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Account and notifications"
          className="absolute right-0 z-40 mt-3 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-2xl border bg-card shadow-xl shadow-primary/10"
        >
          <div className="border-b p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Signed in
            </p>
            <p className="mt-1 font-display text-lg font-semibold leading-tight">{session.userName}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{formatRole(session.role)}</p>
          </div>

          <section className="max-h-96 overflow-y-auto p-3" aria-label="Notifications">
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
              <div className="space-y-2">
                {notifications.items.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    disabled={isPending}
                    onMarkRead={handleMarkRead}
                    onOpenAction={handleOpenAction}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 p-3">
            <a
              href="/settings"
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
            >
              <Gear size={16} aria-hidden="true" />
              Settings
            </a>
            <a
              href={logoutUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <SignOut size={16} aria-hidden="true" />
              Sign out
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({
  notification,
  disabled,
  onMarkRead,
  onOpenAction,
}: {
  notification: Notification;
  disabled: boolean;
  onMarkRead: (notificationId: string) => void;
  onOpenAction: (notification: Notification, href: string) => void;
}) {
  const unread = !notification.readAt;
  const actionHref = getSafeInternalHref(notification.actionHref);

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
            {unread ? (
              <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread notification" />
            ) : null}
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
            className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {notification.actionLabel}
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

function getSafeInternalHref(href: string | null) {
  if (!href?.startsWith("/") || href.startsWith("//")) {
    return null;
  }

  return href;
}

function formatRole(role: AccountMenuProps["session"]["role"]) {
  if (role === "OWNER") {
    return "Owner";
  }

  if (role === "ADMIN") {
    return "Admin";
  }

  return "Member";
}
