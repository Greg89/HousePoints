import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PagedNotifications } from "@housepoints/contracts";
import { NotificationsMenu } from "./NotificationsMenu";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const unreadNotification = {
  id: "notification-1",
  type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT" as const,
  severity: "ACTION_REQUIRED" as const,
  title: "New member needs a house",
  body: "Taylor joined Acme and has not been assigned to a house yet.",
  actionLabel: "Assign house",
  actionHref: "/?tab=manage&section=team",
  entityType: "User",
  entityId: "user-2",
  readAt: null,
  createdAt: "2026-06-26T21:24:13.084Z",
};

const readNotification = {
  ...unreadNotification,
  id: "notification-2",
  title: "Invite accepted",
  body: "Jordan accepted an invite.",
  actionLabel: null,
  actionHref: null,
  severity: "INFO" as const,
  readAt: "2026-06-26T21:30:00.000Z",
};

const baseProps = {
  notifications: {
    items: [unreadNotification, readNotification],
    unreadCount: 1,
    nextCursor: null,
  },
  onNotificationsChange: vi.fn(),
  onMarkNotificationRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  onMarkAllNotificationsRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  dashboardHref: "/o/acme",
};

function NotificationsMenuHarness({
  notifications = baseProps.notifications,
  onNotificationsChange,
  ...props
}: Partial<React.ComponentProps<typeof NotificationsMenu>> & {
  notifications?: PagedNotifications;
} = {}) {
  const [currentNotifications, setCurrentNotifications] = useState(notifications);

  function handleNotificationsChange(nextNotifications: PagedNotifications) {
    setCurrentNotifications(nextNotifications);
    onNotificationsChange?.(nextNotifications);
  }

  return (
    <NotificationsMenu
      {...baseProps}
      {...props}
      notifications={currentNotifications}
      onNotificationsChange={handleNotificationsChange}
    />
  );
}

describe("NotificationsMenu", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("shows unread notification count on the notifications trigger", () => {
    render(<NotificationsMenuHarness />);

    expect(screen.getByRole("button", { name: /notifications menu, 1 unread notifications/i })).toHaveTextContent("1");
  });

  it("shows an empty notification state", async () => {
    const user = userEvent.setup();
    render(
      <NotificationsMenuHarness
        notifications={{ items: [], unreadCount: 0, nextCursor: null }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));

    expect(screen.getByRole("dialog", { name: /notifications/i })).toBeVisible();
    expect(screen.getByRole("dialog", { name: /notifications/i })).toHaveClass("max-h-[calc(100dvh-7rem)]");
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeDisabled();
  });

  it("renders notification details", async () => {
    const user = userEvent.setup();
    render(<NotificationsMenuHarness />);

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));

    const dialog = screen.getByRole("dialog", { name: /notifications/i });
    expect(within(dialog).getByText("New member needs a house")).toBeInTheDocument();
    expect(within(dialog).getByText("Action required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /assign house/i })).toBeInTheDocument();
  });

  it("marks an action notification read before navigating", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <NotificationsMenuHarness
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));
    await user.click(screen.getByRole("button", { name: /assign house/i }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith("notification-1");
    expect(pushMock).toHaveBeenCalledWith("/o/acme?tab=manage&section=team");
  });

  it("marks a release announcement read before opening release notes", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    const releaseNotification = {
      ...unreadNotification,
      id: "notification-release",
      type: "RELEASE_ANNOUNCEMENT" as const,
      severity: "INFO" as const,
      title: "What's new: Multi-org beta",
      body: "Multi-organization support is now available in beta.",
      actionLabel: "View release notes",
      actionHref: "https://housepoints.example/releases/v1.2.3.html",
      entityType: "ReleaseAnnouncement",
      entityId: "release-1",
    };

    render(
      <NotificationsMenuHarness
        notifications={{
          items: [releaseNotification],
          unreadCount: 1,
          nextCursor: null,
        }}
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));
    await user.click(screen.getByRole("button", { name: /view release notes/i }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith("notification-release");
    expect(window.open).toHaveBeenCalledWith(
      "https://housepoints.example/releases/v1.2.3.html",
      "_blank",
      "noopener,noreferrer",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("marks a single notification read from the row action", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <NotificationsMenuHarness
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));
    await user.click(screen.getByRole("button", { name: /mark read/i }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith("notification-1");
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications menu/i })).not.toHaveTextContent("1");
  });

  it("marks all visible notifications read", async () => {
    const user = userEvent.setup();
    const onMarkAllNotificationsRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <NotificationsMenuHarness
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /notifications menu/i }));
    await user.click(screen.getByRole("button", { name: /mark all read/i }));

    expect(onMarkAllNotificationsRead).toHaveBeenCalledOnce();
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeDisabled();
  });
});
