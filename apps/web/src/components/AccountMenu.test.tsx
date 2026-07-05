import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PagedNotifications } from "@housepoints/contracts";
import { AccountMenu } from "./AccountMenu";

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
  session: {
    userName: "Gregory Dodson",
    role: "ADMIN" as const,
    organizationContexts: [
      {
        organizationId: "org-1",
        organizationName: "Acme Corp",
        organizationSlug: "acme",
        role: "ADMIN" as const,
        houseId: "house-1",
        houseName: "Slytherin",
        houseColor: "#22c55e",
        isCurrent: true,
      },
    ],
  },
  notifications: {
    items: [unreadNotification, readNotification],
    unreadCount: 1,
    nextCursor: null,
  },
  onNotificationsChange: vi.fn(),
  onMarkNotificationRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  onMarkAllNotificationsRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  dashboardHref: "/o/acme",
  logoutUrl: "/auth/logout",
};

function AccountMenuHarness({
  notifications = baseProps.notifications,
  onNotificationsChange,
  ...props
}: Partial<React.ComponentProps<typeof AccountMenu>> & {
  notifications?: PagedNotifications;
} = {}) {
  const [currentNotifications, setCurrentNotifications] = useState(notifications);

  function handleNotificationsChange(nextNotifications: PagedNotifications) {
    setCurrentNotifications(nextNotifications);
    onNotificationsChange?.(nextNotifications);
  }

  return (
    <AccountMenu
      {...baseProps}
      {...props}
      notifications={currentNotifications}
      onNotificationsChange={handleNotificationsChange}
    />
  );
}

describe("AccountMenu", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("shows unread notification count on the account trigger", () => {
    render(<AccountMenuHarness />);

    expect(screen.getByRole("button", { name: /account menu, 1 unread notifications/i })).toHaveTextContent("1");
  });

  it("shows an empty notification state", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenuHarness
        notifications={{ items: [], unreadCount: 0, nextCursor: null }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("dialog", { name: /account and notifications/i })).toBeVisible();
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeDisabled();
  });

  it("renders notification details and account links", async () => {
    const user = userEvent.setup();
    render(<AccountMenuHarness />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const dialog = screen.getByRole("dialog", { name: /account and notifications/i });
    expect(dialog).toHaveTextContent("Gregory Dodson");
    expect(dialog).toHaveTextContent("Admin");
    expect(dialog).toHaveTextContent("Acme Corp");
    expect(within(dialog).queryByRole("region", { name: /switch organization/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: /create organisation/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText("New member needs a house")).toBeInTheDocument();
    expect(within(dialog).getByText("Action required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /assign house/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /account/i })).toHaveAttribute("href", "/settings");
    expect(within(dialog).getByRole("link", { name: /sign out/i })).toHaveAttribute("href", "/auth/logout");
    expect(within(dialog).queryByRole("link", { name: /what's new/i })).not.toBeInTheDocument();
  });

  it("shows a persistent What's New link when release notes are configured", async () => {
    const user = userEvent.setup();
    render(<AccountMenuHarness releaseNotesUrl="https://housepoints.example/releases/" />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("link", { name: /what's new/i })).toHaveAttribute(
      "href",
      "https://housepoints.example/releases/",
    );
  });

  it("shows organization switch links when the user belongs to multiple organizations", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenuHarness
        session={{
          ...baseProps.session,
          organizationContexts: [
            ...baseProps.session.organizationContexts,
            {
              organizationId: "org-2",
              organizationName: "Beta Org",
              organizationSlug: "beta",
              role: "OWNER",
              houseId: null,
              houseName: null,
              houseColor: null,
              isCurrent: false,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const switcher = screen.getByRole("region", { name: /switch organization/i });
    expect(within(switcher).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(switcher).getByText("Current")).toBeInTheDocument();
    expect(within(switcher).getByRole("link", { name: /beta org/i })).toHaveAttribute("href", "/o/beta/switch");
    expect(within(switcher).queryByRole("link", { name: /create organisation/i })).not.toBeInTheDocument();
  });

  it("limits organization switch rows and links to the full account organization list", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenuHarness
        session={{
          ...baseProps.session,
          organizationContexts: [
            {
              ...baseProps.session.organizationContexts[0],
              isCurrent: false,
            },
            {
              organizationId: "org-2",
              organizationName: "Beta Org",
              organizationSlug: "beta",
              role: "OWNER",
              houseId: null,
              houseName: null,
              houseColor: null,
              isCurrent: true,
            },
            {
              organizationId: "org-3",
              organizationName: "Gamma Org",
              organizationSlug: "gamma",
              role: "MEMBER",
              houseId: null,
              houseName: null,
              houseColor: null,
              isCurrent: false,
            },
          ],
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const switcher = screen.getByRole("region", { name: /switch organization/i });
    expect(within(switcher).getByText("Beta Org")).toBeInTheDocument();
    expect(within(switcher).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(switcher).queryByText("Gamma Org")).not.toBeInTheDocument();
    expect(within(switcher).getByRole("link", { name: /view all organisations \(1 more\)/i })).toHaveAttribute(
      "href",
      "/settings#organisations",
    );
  });

  it("marks an action notification read before navigating", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <AccountMenuHarness
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));
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
      <AccountMenuHarness
        notifications={{
          items: [releaseNotification],
          unreadCount: 1,
          nextCursor: null,
        }}
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));
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
      <AccountMenuHarness
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("button", { name: /mark read/i }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith("notification-1");
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /account menu/i })).not.toHaveTextContent("1");
  });

  it("marks all visible notifications read", async () => {
    const user = userEvent.setup();
    const onMarkAllNotificationsRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <AccountMenuHarness
        onMarkAllNotificationsRead={onMarkAllNotificationsRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("button", { name: /mark all read/i }));

    expect(onMarkAllNotificationsRead).toHaveBeenCalledOnce();
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all read/i })).toBeDisabled();
  });
});
