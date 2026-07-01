import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  },
  notifications: {
    items: [unreadNotification, readNotification],
    unreadCount: 1,
    nextCursor: null,
  },
  onMarkNotificationRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  onMarkAllNotificationsRead: vi.fn(async () => ({ ok: true as const, updatedCount: 1 })),
  logoutUrl: "/auth/logout",
};

describe("AccountMenu", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("shows unread notification count on the account trigger", () => {
    render(<AccountMenu {...baseProps} />);

    expect(screen.getByRole("button", { name: /account menu, 1 unread notifications/i })).toHaveTextContent("1");
  });

  it("shows an empty notification state", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        {...baseProps}
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
    render(<AccountMenu {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const dialog = screen.getByRole("dialog", { name: /account and notifications/i });
    expect(dialog).toHaveTextContent("Gregory Dodson");
    expect(dialog).toHaveTextContent("Admin");
    expect(within(dialog).getByText("New member needs a house")).toBeInTheDocument();
    expect(within(dialog).getByText("Action required")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /assign house/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(within(dialog).getByRole("link", { name: /sign out/i })).toHaveAttribute("href", "/auth/logout");
  });

  it("marks an action notification read before navigating", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <AccountMenu
        {...baseProps}
        onMarkNotificationRead={onMarkNotificationRead}
      />,
    );

    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("button", { name: /assign house/i }));

    expect(onMarkNotificationRead).toHaveBeenCalledWith("notification-1");
    expect(pushMock).toHaveBeenCalledWith("/?tab=manage&section=team");
  });

  it("marks a single notification read from the row action", async () => {
    const user = userEvent.setup();
    const onMarkNotificationRead = vi.fn(async () => ({ ok: true as const, updatedCount: 1 }));
    render(
      <AccountMenu
        {...baseProps}
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
      <AccountMenu
        {...baseProps}
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
